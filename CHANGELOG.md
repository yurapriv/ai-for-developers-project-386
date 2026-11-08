# Changelog

## 1.0.0 (2026-11-08)


### Features

* add client routing with home, booking, admin and not-found pages ([215c77f](https://github.com/yurapriv/ai-for-developers-project-386/commit/215c77fcf074b9659128a45c85eab4920c9e9563))
* add meeting slot selection ([8e5b679](https://github.com/yurapriv/ai-for-developers-project-386/commit/8e5b679e3cb927ea9a3224b86eb8e67d57f24ee3)), closes [#6](https://github.com/yurapriv/ai-for-developers-project-386/issues/6)
* add TypeSpec API contract with generated artifacts ([433dc85](https://github.com/yurapriv/ai-for-developers-project-386/commit/433dc85c0129193af311aa77839adbaac7e66acf))
* create bookings with atomic conflict protection ([3138de2](https://github.com/yurapriv/ai-for-developers-project-386/commit/3138de2eb9b3112f48258878881f66aec38808f6)), closes [#7](https://github.com/yurapriv/ai-for-developers-project-386/issues/7)
* expose meeting types over the http api ([fd71824](https://github.com/yurapriv/ai-for-developers-project-386/commit/fd71824b9f93aef0ed32e56c621892d11c08a1d2)), closes [#5](https://github.com/yurapriv/ai-for-developers-project-386/issues/5)
* implement calendar meeting booking ([e973b97](https://github.com/yurapriv/ai-for-developers-project-386/commit/e973b97f37d0b2bce18d63d4b1befd4523d293d9))
* integrate meeting slot selection ([66993d9](https://github.com/yurapriv/ai-for-developers-project-386/commit/66993d9718e4b939dd19a950cdd19c41018d3dce)), closes [#6](https://github.com/yurapriv/ai-for-developers-project-386/issues/6)
* render health status in React frontend via generated SDK ([0b95af5](https://github.com/yurapriv/ai-for-developers-project-386/commit/0b95af5c0ee1126ab98bd2674a58bb1cd5ccde8f))
* run the application in a container ([485943b](https://github.com/yurapriv/ai-for-developers-project-386/commit/485943b1b8228dd531b9c1a8870084b55dbb8ddf)), closes [#10](https://github.com/yurapriv/ai-for-developers-project-386/issues/10)
* serve health endpoint with strict generated API ([d7a712c](https://github.com/yurapriv/ai-for-developers-project-386/commit/d7a712ca0f1ae72e4d55526c085e9ee98c725e83))
* show meeting types in booking and create them in admin ([8268b7c](https://github.com/yurapriv/ai-for-developers-project-386/commit/8268b7ce3120ac4b1f82b49b7f7c4f9876c2ba73)), closes [#5](https://github.com/yurapriv/ai-for-developers-project-386/issues/5)
* show upcoming bookings to calendar owner ([c8b8656](https://github.com/yurapriv/ai-for-developers-project-386/commit/c8b8656b895abbf96acb529272a7b3c27f327cfc)), closes [#8](https://github.com/yurapriv/ai-for-developers-project-386/issues/8)
* главная страница и клиентская навигация ([2599433](https://github.com/yurapriv/ai-for-developers-project-386/commit/2599433dfc1a5de8d7355def93978c3493240dd4))


### Bug Fixes

* accept release-please generated formatting ([8f185ba](https://github.com/yurapriv/ai-for-developers-project-386/commit/8f185badd710f151837d8d5aba88d57cfcc186c5))
* accept release-please generated formatting ([c74e67d](https://github.com/yurapriv/ai-for-developers-project-386/commit/c74e67d4f6ad9eaa18005eb7696f4bef2c21f7aa)), closes [#4](https://github.com/yurapriv/ai-for-developers-project-386/issues/4)
* handle uncertain bookings and stale catalog responses ([55b0ef2](https://github.com/yurapriv/ai-for-developers-project-386/commit/55b0ef29b11c04d7f22c705833f7f94a99348284))
* harden guest booking against in-flight races ([12294f0](https://github.com/yurapriv/ai-for-developers-project-386/commit/12294f06943d1a62dd611d1f0b2a03b469f3d98b))
* recover guest booking after slot conflict ([155ce0f](https://github.com/yurapriv/ai-for-developers-project-386/commit/155ce0f49df6143a0c28d40086cc0b48c3600f0e)), closes [#9](https://github.com/yurapriv/ai-for-developers-project-386/issues/9)
