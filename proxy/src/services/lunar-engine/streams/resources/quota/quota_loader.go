package quotaresource

import (
	"io/fs"
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	resourceutils "lunar/engine/streams/resources/utils"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"lunar/toolkit-core/network"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
)

type Loader struct {
	loadedConfig []network.ConfigurationPayload
	flowData     map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation
	quotas       *resourceutils.Resource[QuotaAdmI]
}

func NewLoader() (*Loader, error) {
	loader := &Loader{
		loadedConfig: []network.ConfigurationPayload{},
		quotas:       resourceutils.NewResource[QuotaAdmI](),
		flowData:     make(map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation),
	}
	err := loader.init()
	if err != nil {
		return nil, err
	}
	return loader, nil
}

func (l *Loader) WithData(
	quotaData []*QuotaResourceData,
) (*Loader, error) {
	if err := l.loadQuotaResources(quotaData); err != nil {
		return nil, err
	}
	return l, nil
}

func (l *Loader) GetQuotas() *resourceutils.Resource[QuotaAdmI] {
	return l.quotas
}

func (l *Loader) GetFlowData() map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation { //nolint: lll
	return l.flowData
}

func (l *Loader) GetLoadedConfig() []network.ConfigurationPayload {
	return l.loadedConfig
}

func (l *Loader) init() error {
	quotaData, err := l.loadAndParseQuotaFiles()
	if err != nil {
		return err
	}

	return l.loadQuotaResources(quotaData)
}

func (l *Loader) loadAndParseQuotaFiles() (
	[]*QuotaResourceData,
	error,
) {
	quotasPath := environment.GetQuotasDirectory()
	quotaResourceFiles, err := findQuotaResources(quotasPath)
	var quotaData []*QuotaResourceData
	if err != nil {
		return nil, err
	}
	for _, path := range quotaResourceFiles {
		config, readErr := configuration.DecodeYAML[QuotaResourceData](path)
		if readErr != nil {
			return nil, readErr
		}
		l.loadedConfig = append(l.loadedConfig, network.ConfigurationPayload{
			Type:     "quota-resource",
			FileName: path,
			Content:  config.Content,
		})
		quotaData = append(quotaData, config.UnmarshaledData)
	}
	return quotaData, nil
}

func (l *Loader) loadQuotaResources(
	quotaData []*QuotaResourceData,
) error {
	for _, metaData := range quotaData {
		quotaResource, err := NewQuota(metaData)
		if err != nil {
			return err
		}

		log.Trace().Msgf("Adding quota resource with: ID %s, Filter: %v",
			metaData.Quota.ID,
			metaData.Quota.Filter,
		)

		for _, id := range quotaResource.GetIDs() {
			l.quotas.Set(id, quotaResource)
		}

		for comparableFilter, systemFlow := range quotaResource.GetSystemFlow() {
			log.Trace().Msgf("Adding system flow with Key: %v", comparableFilter)
			log.Trace().Msgf("SystemFlowID: %v", systemFlow.GetID())
			if _, found := l.flowData[comparableFilter]; !found {
				l.flowData[comparableFilter] = systemFlow
			} else {
				if err := l.flowData[comparableFilter].AddSystemRepresentation(systemFlow); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func findQuotaResources(dir string) ([]string, error) {
	var files []string
	err := filepath.WalkDir(dir, func(path string, directory fs.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) { // ignore if directory does not exist
				return nil
			}
			return err
		}

		if !directory.IsDir() && strings.HasSuffix(path, internaltypes.YAMLExtension) {
			files = append(files, path)
		}
		return nil
	})
	return files, err
}
