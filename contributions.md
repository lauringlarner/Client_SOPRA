# Contributions

Every member has to complete at least 2 meaningful tasks per week, where a
single development task should have a granularity of 0.5-1 day. The completed
tasks have to be shown in the weekly TA meetings. You have one "Joker" to miss
one weekly TA meeting and another "Joker" to once skip continuous progress over
the remaining weeks of the course. Please note that you cannot make up for
"missed" continuous progress, but you can "work ahead" by completing twice the
amount of work in one week to skip progress on a subsequent week without using
your "Joker". Please communicate your planning **ahead of time**.

Note: If a team member fails to show continuous progress after using their
Joker, they will individually fail the overall course (unless there is a valid
reason).

**You MUST**:

- Have two meaningful contributions per week.

**You CAN**:

- Have more than one commit per contribution.
- Have more than two contributions per week.
- Link issues to contributions descriptions for better traceability.

**You CANNOT**:

- Link the same commit more than once.
- Use a commit authored by another GitHub user.

---

## Contributions Week 1 - [23.03.2026] to [29.03.2026]

| **Student** | **Date** | **Link to Commit** | **Description** | **Relevance** |
| ----------- | -------- | ------------------ | --------------- | ------------- |
| **[@AleMarti0]** | [24.03.2026] | [https://github.com/lauringlarner/Client_SOPRA/commit/105e4c3661e9a3615e7952afd5d02f0d572abf6f], [https://github.com/lauringlarner/Client_SOPRA/commit/acd1d35a39c5a7d0e019c5b18858f6bd8b04c9a7], [https://github.com/lauringlarner/Client_SOPRA/commit/ca743074ce70cc2fba5ca80a02c704a167fbbac7] | [Implemented Bingo card UI and state logic for captured vs. not captured fields.] | [Provides the central gameplay interface, allowing players to click and choose items to capture; backend not integrated yet.] |
| | [25.03.2026] | [https://github.com/lauringlarner/Client_SOPRA/commit/d76c7052ba76be075a72a5fd961eb6915dd09f2c] | [Camera & Image Preview: Full UI and capture logic.] | [Enables the core Bingo "Proof of Completion" workflow; provides the image input for Vertex AI validation; backend not integrated yet.] |
| | [29.03.2026] | [https://github.com/lauringlarner/Client_SOPRA/commit/7988c1ad2029bfb7c90bc8925a54618a47f80f89] | [Added the user profile screen with edit profile and stats overlay.] | [Lets players review personal information and manage account-related details through a centralized profile interface.] |
| **[@lauringlarner]** | [23.03.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/53bbc115a6692b5356e7c743d9312e629b403441] | [Implemented image-to-word matching with Google Vision API, including similarity scoring, top-5 classifications, and a 300-object urban word list with random selection.] | [Provides the image validation and word generation needed for the bingo gameplay loop.] |
| | [28.03.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/40548633b4bbaa04ac3e1c965f06487a79f749cc] | [Added core game backend logic, including entity, mappers, controller, and service, plus automatic assignment of a random 16-word list when creating a game.] | [Establishes the server-side game state required to create, load, and synchronize running games.] |
| **[@Wallimann20-914-099]** | [26.03.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/3e55900cab5d9fc5a8bd55ed2d70bc39e1332c47], [https://github.com/lauringlarner/Server_SOPRA/commit/1ebbe14a23d094cc1c0fac19023e89567e865bb5], [https://github.com/lauringlarner/Server_SOPRA/commit/c4dd6a7e3ecedac8e49d855bcea9a0545a2fa34c], [https://github.com/lauringlarner/Server_SOPRA/commit/3b584b1b4aab7de378a82f230f4c888e6f9128c5] | [Implemented lobby creation and lobby retrieval endpoints, including the required RestController, service layer, entities, and DTOs.] | [Provides the pre-game lobby flow where players can gather, see settings, and prepare a match before it starts.] |
| | [27.03.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/38a080da93b5c06043c0eaf1e5ab632c82593842], [https://github.com/lauringlarner/Server_SOPRA/commit/fbe25c4565d1d412bd4188c1db4ffe0e20578587] | [Implemented the `/lobbies/join` endpoint and fixed lobby/lobby-player repository usage.] | [Gives players the ability to join an existing lobby, which is essential for multiplayer flow.] |
| **[@aydinarda]** | [24.03.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/597123d5e0aa78c23e14f09f438018396bd12fd9] | [Implemented login and registration logic, including the `User` entity, controller, service, repository, and related DTOs.] | [Provides the authentication flow required before users can access game features.] |
| | [27.03.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/6e791b1a352c90b88ddf6f5fea7d5e7a99977714] | [Refactored user-related classes to use UUID instead of `Long`, added a password field, fixed missing email assignments, and aligned tests.] | [Improves consistency of user identification and stabilizes the authentication model and tests.] |
| | [27.03.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/ca0689893a76db443575451c59efe0c260681f0c] | [Explored the Google Vision API by switching to `OBJECT_LOCALIZATION` mode, adding a score threshold, and testing on sample images.] | [Validates a practical image-detection approach for the object-recognition mechanic.] |
| **[@mel-kne]** | [23.03.2026] | [https://github.com/lauringlarner/Client_SOPRA/commit/c67d6d074382fa7c711ac5c50379bda64c73f9d3], [https://github.com/lauringlarner/Client_SOPRA/commit/60935aaad6c1d8a0f774b405e5995c004e2b2670] | [Created the initial frontend scaffold from the Figma mockup and Milestone 1, including landing, login, register, menu, lobby, and game-related pages, plus temporary mocked auth and session handling.] | [Established the navigable client skeleton so the team could demo core user flows and continue frontend development before backend integration was ready.] |
| | [29.03.2026] | [https://github.com/lauringlarner/Client_SOPRA/commit/81a44e694a0cca308ffc5467716906c6222ef6a3] | [Added the mocked leaderboard screen and polished the app branding with demo leaderboard data, updated title and icon assets, and the landing-page hero image.] | [Completes the post-game ranking experience for demos and makes the prototype more coherent and presentation-ready.] |

---

## Contributions Week 2 - [Begin Date] to [End Date]

| **Student**        | **Date** | **Link to Commit** | **Description**                 | **Relevance**                       |
| ------------------ | -------- | ------------------ | ------------------------------- | ----------------------------------- |
| **[@githubUser1]** | [date]   | [Link to Commit 1] | [Brief description of the task] | [Why this contribution is relevant] |
|                    | [date]   | [Link to Commit 2] | [Brief description of the task] | [Why this contribution is relevant] |
| **[@githubUser2]** | [date]   | [Link to Commit 1] | [Brief description of the task] | [Why this contribution is relevant] |
|                    | [date]   | [Link to Commit 2] | [Brief description of the task] | [Why this contribution is relevant] |
| **[@githubUser3]** | [date]   | [Link to Commit 1] | [Brief description of the task] | [Why this contribution is relevant] |
|                    | [date]   | [Link to Commit 2] | [Brief description of the task] | [Why this contribution is relevant] |
| **[@githubUser4]** | [date]   | [Link to Commit 1] | [Brief description of the task] | [Why this contribution is relevant] |
|                    | [date]   | [Link to Commit 2] | [Brief description of the task] | [Why this contribution is relevant] |

---

## Contributions Week 3 - [Begin Date] to [End Date]

_Continue with the same table format as above._

---

## Contributions Week 4 - [Begin Date] to [End Date]

_Continue with the same table format as above._

---

## Contributions Week 5 - [Begin Date] to [End Date]

_Continue with the same table format as above._

---

## Contributions Week 6 - [Begin Date] to [End Date]

_Continue with the same table format as above._
