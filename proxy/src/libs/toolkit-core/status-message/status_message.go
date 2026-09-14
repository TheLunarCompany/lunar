package statusmessage

import (
	"fmt"
	"sync"

	"github.com/rs/zerolog/log"
)

type StatusMessage struct {
	mutex    sync.Mutex
	messages map[string][]string
	wasSent  bool
}

func NewStatusMessage() *StatusMessage {
	return &StatusMessage{
		messages: make(map[string][]string),
	}
}

func (sm *StatusMessage) AddMessage(component, msg string) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()
	if sm.wasSent {
		return
	}
	if _, ok := sm.messages[component]; !ok {
		sm.messages[component] = []string{}
	}
	sm.messages[component] = append(sm.messages[component], msg)
}

func (sm *StatusMessage) Notify() {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()
	sm.wasSent = true
	componentLogger := log.Info()
	combinedMsgs := "Lunar Gateway Status Summarization\n"
	for component, msgs := range sm.messages {
		combinedMsgs += fmt.Sprintf("\t\t\t\t\t%+s:\r\n", component)
		for _, msg := range msgs {
			combinedMsgs += fmt.Sprintf("\t\t\t\t\t\t%+s\r\n", msg)
		}

	}
	componentLogger.Msg(combinedMsgs)
}
