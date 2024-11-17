package streamfilter

import (
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	"lunar/toolkit-core/urltree"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

/*
TODO:

	Once we add support for JSONPath, we can remove the transactional flow.
	This was made for understanding the flow of the request and response.
*/
type transactionalFlow struct {
	flowPerTransaction map[string][]internaltypes.FilterTreeResultI
	expirationTimes    map[string]time.Time
	ttl                time.Duration
	mu                 sync.Mutex
	stopCh             chan struct{}
}

func newTransactionalFlow(ttl time.Duration) *transactionalFlow {
	tFlows := &transactionalFlow{
		flowPerTransaction: make(map[string][]internaltypes.FilterTreeResultI),
		expirationTimes:    make(map[string]time.Time),
		ttl:                ttl,
	}
	go tFlows.startExpirationWorker()
	return tFlows
}

func (tf *transactionalFlow) addFlow(
	transactionID string,
	flows []internaltypes.FilterTreeResultI,
) {
	tf.mu.Lock()
	defer tf.mu.Unlock()
	tf.flowPerTransaction[transactionID] = flows
	tf.expirationTimes[transactionID] = time.Now().Add(tf.ttl)
}

func (tf *transactionalFlow) getFlow(transactionID string) []internaltypes.FilterTreeResultI {
	tf.mu.Lock()
	defer tf.mu.Unlock()
	flows, found := tf.flowPerTransaction[transactionID]

	if !found {
		log.Debug().Msgf("transactionalFlow::No flow found for transaction: %s\n", transactionID)
		return nil
	}

	return flows
}

func (tf *transactionalFlow) removeFlow(transactionID string) {
	tf.mu.Lock()
	defer tf.mu.Unlock()

	delete(tf.flowPerTransaction, transactionID)
	delete(tf.expirationTimes, transactionID)
	log.Trace().Msgf("transactionalFlow::Manually removed transaction: %s\n", transactionID)
}

func (tf *transactionalFlow) startExpirationWorker() {
	ticker := time.NewTicker(1 * time.Minute) // Check every minute
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			tf.removeExpiredKeys()

		case <-tf.stopCh:
			return
		}
	}
}

func (tf *transactionalFlow) removeExpiredKeys() {
	tf.mu.Lock()
	defer tf.mu.Unlock()

	now := time.Now()
	for transactionID, expiration := range tf.expirationTimes {
		if now.After(expiration) {
			// Key has expired, remove it
			delete(tf.flowPerTransaction, transactionID)
			delete(tf.expirationTimes, transactionID)
			log.Trace().Msgf("transactionalFlow::Deleted expired transaction: %s\n", transactionID)
		}
	}
}

type FilterTree struct {
	tree               *urltree.URLTree[FilterNode]
	transactionalFlows *transactionalFlow
}

func NewFilterTree() internaltypes.FilterTreeI {
	return &FilterTree{
		tree:               urltree.NewURLTree[FilterNode](false, 0),
		transactionalFlows: newTransactionalFlow(10 * time.Minute),
	}
}

// Add a flow with specified filter to the filter tree
func (f *FilterTree) AddFlow(flow internaltypes.FlowI) error {
	filter := flow.GetFilter()
	result := f.tree.Lookup(filter.GetURL())
	if result.Match {
		switch flow.GetType() {
		case internaltypes.UserFlow:
			return result.Value.addUserFlow(flow)
		case internaltypes.SystemFlowStart:
			return result.Value.addSystemFlowStart(flow)
		case internaltypes.SystemFlowEnd:
			return result.Value.addSystemFlowEnd(flow)
		}
	}
	var filterNode *FilterNode

	log.Debug().Msgf("Adding %s flow to filter tree: %v", flow.GetType().String(), filter.GetURL())
	switch flow.GetType() {
	case internaltypes.UserFlow:
		filterNode = &FilterNode{
			userFlows:          []internaltypes.FlowI{flow},
			systemFlowStart:    []internaltypes.FlowI{},
			systemFlowEnd:      []internaltypes.FlowI{},
			filterRequirements: newFilterRequirements(flow),
		}
	case internaltypes.SystemFlowStart:
		filterNode = &FilterNode{
			userFlows:          []internaltypes.FlowI{},
			systemFlowStart:    []internaltypes.FlowI{flow},
			systemFlowEnd:      []internaltypes.FlowI{},
			filterRequirements: newFilterRequirements(nil),
		}
	case internaltypes.SystemFlowEnd:
		filterNode = &FilterNode{
			userFlows:          []internaltypes.FlowI{},
			systemFlowStart:    []internaltypes.FlowI{},
			systemFlowEnd:      []internaltypes.FlowI{flow},
			filterRequirements: newFilterRequirements(nil),
		}
	}
	return f.tree.InsertDeclaredURL(filter.GetURL(), filterNode)
}

// Get flow based on the API stream
func (f *FilterTree) GetFlow(
	APIStream publictypes.APIStreamI,
) ([]internaltypes.FilterTreeResultI, bool) {
	flows := f.transactionalFlows.getFlow(APIStream.GetID())
	if flows != nil {
		f.transactionalFlows.removeFlow(APIStream.GetID())
		return flows, true
	}

	url := APIStream.GetURL()
	lookupResult := f.tree.Traversal(url)
	if lookupResult.Value == nil || len(lookupResult.Value) == 0 {
		log.Trace().Msgf("No filter found for %v", url)
		return nil, false
	}

	filterNode := lookupResult.Value
	flows = []internaltypes.FilterTreeResultI{}
	var flow internaltypes.FilterTreeResultI
	found := false
	for _, node := range filterNode {
		flow, found = node.getFlow(APIStream)
		if found {
			flows = append(flows, flow)
		}
	}

	f.transactionalFlows.addFlow(APIStream.GetID(), flows)
	return flows, found
}
