package statusmessage

import (
	"fmt"

	"github.com/rs/zerolog/log"
)

type StatusMessage struct {
	messages map[string][]string
}

func NewStatusMessage() *StatusMessage {
	return &StatusMessage{
		messages: make(map[string][]string),
	}
}

func (sm *StatusMessage) AddMessage(component, msg string) {
	if _, ok := sm.messages[component]; !ok {
		sm.messages[component] = []string{}
	}
	sm.messages[component] = append(sm.messages[component], msg)
}

func (sm *StatusMessage) Notify() {
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
