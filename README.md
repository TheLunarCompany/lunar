<div align="center">
<img src="readme-files/logo-light.png#gh-light-mode-only" width="50%" height="50%" />
<img src="readme-files/logo-dark.png#gh-dark-mode-only" width="50%" height="50%" />

<a href="https://opensource.org/licenses/MIT">![License](https://img.shields.io/badge/License-MIT-blue.svg)</a>
<a href="https://docs.lunar.dev/">![Documentation](https://img.shields.io/badge/docs-viewdocs-blue.svg?style=flat-square "Viewdocs")</a>
<a href="https://lunar.dev/">![Website](https://img.shields.io/badge/lunar.dev-website-purple.svg?style=flat-square "Website")</a>

</div>

# Welcome to Lunar.dev

**Lunar.dev** is an open-source platform for **managing, governing and optimizing** third-party API consumption across applications and AI agent workloads at scale.

<div  align="center">
<img src="readme-files/lunar-flow-light.svg#gh-light-mode-only" >
<img src="readme-files/lunar-flow-dark.svg#gh-dark-mode-only"  >
</div>

## Consumption Management for the AI Era

As AI agents and autonomous workflows increasingly rely on external APIs, there's a growing need for a mediation layer that acts as a central aggregation point between applications, agents, and the services they depend on.

Lunar.dev provides that layer—serving as a unified API Gateway for AI, delivering:

- **Live API Traffic Visibility:** Get real-time metrics on latency, errors, cost, and token usage across all outbound traffic, including LLM and agent calls.
- **AI-Aware Policy Enforcement:** Control tool access, throttle agent actions, and govern agentic traffic with fine-grained rules.
- **Advanced Traffic Shaping:** Apply rate limits, retries, priority queues, and circuit breakers to manage load and ensure reliability.
- **Cost & Performance Optimization:** Identify waste, smooth traffic peaks, and reduce overuse of costly APIs through smart gateway policies.
- **Centralized MCP Aggregation:** Streamline operations by consolidating multiple MCP servers into a single gateway, enhancing security, observability, and management.

## Choose Your Path

Lunar.dev is composed of two major components:

- [**Lunar Proxy**](https://github.com/TheLunarCompany/lunar/tree/main/proxy#readme) – our core API gateway and control layer
- [**Lunar MCPX**](https://github.com/TheLunarCompany/lunar/tree/main/mcpx#readme) – a zero-code aggregator for multiple MCP servers with unified API access

Explore the one that fits your needs—or use both for a full-stack solution.

## Open Source at the Core

This project was born out of the need for a more robust, production-ready approach to managing third-party APIs. It remains open-source at its core and free for non-production/personal use. For production environments, we offer advanced features through guided onboarding and platform tiers; [visit our website](https://lunar.dev) or reach out directly for more information
