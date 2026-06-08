# Changelog

# [0.4.0](https://github.com/ngxhuyhoang/react-native-thermal-printer/compare/v0.3.0...v0.4.0) (2026-06-09)


### Features

* **iOS:** connect by hostname, mDNS (`.local`) or IPv6 via `getaddrinfo` (was IPv4-only) ([4d47ec1](https://github.com/ngxhuyhoang/react-native-thermal-printer/commit/4d47ec1c208f628344d9497dbeeb567479c504f4))


### Bug Fixes

* **iOS:** enforce connection `timeout` with a non-blocking connect + `poll()` — a blocking connect previously ignored the timeout and could hang ~75s on an unreachable printer ([4d47ec1](https://github.com/ngxhuyhoang/react-native-thermal-printer/commit/4d47ec1c208f628344d9497dbeeb567479c504f4))
* **reconnect:** re-send `initialize()` after a successful auto-reconnect so printer state matches a fresh connection ([4d47ec1](https://github.com/ngxhuyhoang/react-native-thermal-printer/commit/4d47ec1c208f628344d9497dbeeb567479c504f4))
* **reconnect:** emit an `error` event when auto-reconnect gives up after `maxRetries` ([4d47ec1](https://github.com/ngxhuyhoang/react-native-thermal-printer/commit/4d47ec1c208f628344d9497dbeeb567479c504f4))

# [0.3.0](https://github.com/ngxhuyhoang/react-native-thermal-printer/compare/v0.2.0...v0.3.0) (2026-04-01)


### Features

* update ([b886eb5](https://github.com/ngxhuyhoang/react-native-thermal-printer/commit/b886eb593363fe0c7bef8f91313bf062da76d481))
