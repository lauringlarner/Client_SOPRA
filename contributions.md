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

| **Student**        | **Date** | **Link to Commit** | **Description**                 | **Relevance**                       |
| ------------------ | -------- | ------------------ | ------------------------------- | ----------------------------------- |
| **[@AleMarti0]** | [24.03.2026]   | [https://github.com/lauringlarner/Client_SOPRA/commit/105e4c3661e9a3615e7952afd5d02f0d572abf6f], [https://github.com/lauringlarner/Client_SOPRA/commit/acd1d35a39c5a7d0e019c5b18858f6bd8b04c9a7], [https://github.com/lauringlarner/Client_SOPRA/commit/ca743074ce70cc2fba5ca80a02c704a167fbbac7] | [Implemented Bingo card UI and state logic for captured vs. not captured fields.] | [Provides the central gameplay interface, allowing players to click and choose items to capture; backend not integrated yet.] |
|                    | [25.03.2026]   | [https://github.com/lauringlarner/Client_SOPRA/commit/d76c7052ba76be075a72a5fd961eb6915dd09f2c] | [Camera & Image Preview: Full UI and capture logic.] | [Enables the core Bingo "Proof of Completion" workflow; provides the image input for Vertex AI validation; backend not integrated yet.] |
|                    | [29.03.2026]   | [https://github.com/lauringlarner/Client_SOPRA/commit/7988c1ad2029bfb7c90bc8925a54618a47f80f89] | [Added the User profile screen with edit profile & stats overlay] | [The user has to be able to see their personal information and manage their account security through a centralized profile interface.] |
| **[@lauringlarner]** | [23.03.2026]   | [https://github.com/lauringlarner/Server_SOPRA/commit/53bbc115a6692b5356e7c743d9312e629b403441] | [Task 1 -Implementing function to send and image and a word to google vision api and recieve a likeness from 0-1. It also gets back the top 5 classifications of the picture, if the word is in those top 5 calssififcations,the word is in the picture. Made class wordlist which consists of 300 urban object in a csv file and class word, which picks one random from the whole list.] | [We need to able to check if the object is in the picture they upload, also we need words for the bingo card so they can search tose objects] |
|                    | [28.03.2026]| [https://github.com/lauringlarner/Server_SOPRA/commit/40548633b4bbaa04ac3e1c965f06487a79f749cc] | added the whole game logic, so the entity the mappers the controller and the servoce, your now able to call post/games and get/games, aslo when creating a random 16 wordlist is added to the entity | its necessary for running the game that we have an entity, so we can sync the game state with all players |
| **[@Wallimann20-914-099]** | [26.03.2026]   | [https://github.com/lauringlarner/Server_SOPRA/commit/3e55900cab5d9fc5a8bd55ed2d70bc39e1332c47] [https://github.com/lauringlarner/Server_SOPRA/commit/1ebbe14a23d094cc1c0fac19023e89567e865bb5] [https://github.com/lauringlarner/Server_SOPRA/commit/c4dd6a7e3ecedac8e49d855bcea9a0545a2fa34c] [https://github.com/lauringlarner/Server_SOPRA/commit/3b584b1b4aab7de378a82f230f4c888e6f9128c5] | [Implemented the necessary things (RestController, ServiceClass, Enteties, DTOs ...) to implement creation of a lobby from the endpoint /lobbies and implemented getting lobby Information from the endpoint /lobbies/{lobbyId}] | [Before a game starts we need a lobby where users can enter and receive lobby information to view other players and the games settings] |
|                    | [27.03.2026]   | [https://github.com/lauringlarner/Server_SOPRA/commit/38a080da93b5c06043c0eaf1e5ab632c82593842] [https://github.com/lauringlarner/Server_SOPRA/commit/fbe25c4565d1d412bd4188c1db4ffe0e20578587] | [Implemented the /lobbies/join endpoint and fixed lobby/lobbyPlayer repositories use] | [A user needs a way to be able to join a lobby] |
| **[@aydinarda]** | [24.03.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/597123d5e0aa78c23e14f09f438018396bd12fd9] | Implemented login and registration logic. Created User entity, UserController, UserService, UserRepository and related DTOs. Safety not enhanced. | Core authentication flow required for all game features. |
|                  | [27.03.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/6e791b1a352c90b88ddf6f5fea7d5e7a99977714] | Refactored User-related classes to use UUID instead of Long for userId. Added password field, fixed missing email assignments, aligned tests and other small fixes. | Ensures consistent user identification across the system and better test logic. |
|                  | [27.03.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/ca0689893a76db443575451c59efe0c260681f0c] | Explored Google Vision API: switched to OBJECT_LOCALIZATION mode as a substitute, added score threshold though not fine tuned yet. Tested on sample images. | Validates the image detection approach needed. |
|**[@mel-kne]** | [23.03.2026] | [https://github.com/lauringlarner/Client_SOPRA/commit/60935aaad6c1d8a0f774b405e5995c004e2b2670] | Built the initial Milestone 2 client skeleton from the Figma mockup by adding the register, login, main menu, lobby, game board, submission, and leaderboard routes, plus temporary mocked auth and route protection. Related frontend issues: #100, #104, #106, #108, #109, #110, #2, #19.  |[Provides the frontend structure for the core user flow from authentication to lobby and gameplay screens, allowing the team to demo and iterate on the client before full backend integration.|
|**[@mel-kne]** | [29.03.2026] | https://github.com/lauringlarner/Client_SOPRA/commit/81a44e694a0cca308ffc5467716906c6222ef6a3 | Implemented the mocked leaderboard screen from the Figma mockup and polished app branding by adding the landing hero image, updating the app title/metadata, and replacing the favicon with the VisionQuest SVG icon. Related frontend issues: #41, #44, #62, #71.] | Adds the end-of-game results screen needed to complete the player journey and improves the overall presentation quality of the app for milestone demos.
---

## Contributions Week 2 - [30.03.2026] to [12.04.2026]

| **Student**        | **Date** | **Link to Commit** | **Description**                 | **Relevance**                       |
| ------------------ | -------- | ------------------ | ------------------------------- | ----------------------------------- |
| **[@AleMarti0]** | [04.04.2026]   | [https://github.com/lauringlarner/Client_SOPRA/commit/4f43fa59b8bacabad00551bc3ee0083263558b68] [https://github.com/lauringlarner/Client_SOPRA/commit/e5b14e729a2e1e85cb6927f322b6d60b45c6a6a3] | [Connecting the Frontend pages (register, login, user profile)with the backend and adapting the frontend to fit the backend data representations] | [The User has to be able to create an account, login and change the password. Without these functionalities, the user could not use our application.] |
|                    | [11.04.2026] and [12.04.2026]   | [https://github.com/lauringlarner/Client_SOPRA/commit/db646b2f3310e7b1ef75b96ca0cbff409970bd96] [https://github.com/lauringlarner/Client_SOPRA/commit/5a143672846724ad60fc10c6acd42b8b7d478997] | [Connecting the image submission with the backend and adding feedback for user when submitting. Additionally adding the Game Rules on the menu with an overlay] | [The submission functionality is one of the main components for the bingo game. The user needs to be able to send the image to the backend and see that the image is getting validated. For the Game Rules commit, it is relevant, because the user has to be able to inform himself to understand how the game works.] |
| **[@lauringlarner]** | [04.04.26]   | [https://github.com/lauringlarner/Server_SOPRA/commit/939973af82c38739504c39c9457246a0f4f7bf02] | [I further developed the picture analysis, i adjusted the input and output format to match our expections, then i added it as a Rest endpoint, i also further developed the game entity, to be more complete. ] | [Before our pictue ananlysis was only a proof of concepts, now i concentratet all fucntionalities. Now, a single rest endpoint is possible, there we can connect all logic.] |
|                    | [09.04.2026]   | [https://github.com/lauringlarner/Server_SOPRA/commit/5fcfeb78ff539e326d390366dbb5215fbeea70cd] | [I fully completed the object recognition endpoint. You can now send a picture, and it will make all checks(correct game,correct team,correct word etc) and pass it to the api, there it will analyse it and give meaningfull returns.] | [Our whole game is build on this featuer, to upload pictuer and identitfy objects indem.] |
| **[@aydinarda]** | [07.04.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/b445b70] [https://github.com/lauringlarner/Server_SOPRA/commit/e802b8f] | [Implemented game timer feature using polling. Added GameTimer entity, GameTimerRepository, GameTimerDTO, GameTimerController (POST/GET endpoints) and GameTimerService with duration validation (5–120 min). Enabled scheduling in Application.java. After that refactored GameTimer module to use gameId, there was a small mistake.] | [The game requires a time limit to keep rounds structured; this timer tracks elapsed time and exposes remaining minutes to clients for countdown display and automatic game termination.] |
|                  | [09.04.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/b66ba42] [https://github.com/lauringlarner/Server_SOPRA/commit/9bcd349] | [Implemented bcrypt password hashing to store password. Added password complexity rules: minimum 12 characters, at least one digit and one special character.] | [Instead of storing as plain text; hashing ensures credentials are protected and complexity rules reduce vulnerability.] |
|                  | [30.03.2026] | [https://github.com/lauringlarner/Server_SOPRA/commit/07fe064] | [Created AuthService and moved authentication logic (checkAuthToken, extractTokenFromBearer) out of UserController into it. Split getUserByToken into isValidToken and getUserByToken.] | [Separating auth into a new dedicated service improves removes duplicate logic.] |
| **[@Wallimann20-914-099]** | [06.04.2026]   | [https://github.com/lauringlarner/Server_SOPRA/commit/955c866400ae024b2b6cf0eaf3d3b1b4658710da] | [Implemented all the other Lobby functionalities/endpoints that weren't done yet. (PUT /lobbies/{lobbyId}/players/{LobbyPlayerId}/team, PUT /lobbies/{lobbyId}/players/{LobbyPlayerId}/ready, POST /lobbies/{lobbyId}/start, DELETE /lobbies/{lobbyId}, DELETE /lobbies/{lobbyId}/players/me, PUT /lobbies/{lobbyId}/settings) and changed the lobby endoint to get the lobby state to be an SSE endpoint.] | [It implements the rest of the Lobby functionality that is an importent core functionalty of our game.] |
|                    | [07.04.2026]   | [https://github.com/lauringlarner/Server_SOPRA/commit/c68f69231cff81e477a6b5d55f3050b6126ae88a] [https://github.com/lauringlarner/Server_SOPRA/commit/b58f06e802aad21133309168540161f8c714247e] [https://github.com/lauringlarner/Server_SOPRA/commit/9db4ec6fc5206dd6c4f2a65721ea7d12eee80a4b] [https://github.com/lauringlarner/Server_SOPRA/commit/7788c746cf1c235deb854c5c978340fff153d891] [https://github.com/lauringlarner/Server_SOPRA/commit/d627bfca49ded1a7106fa238e224917900b5649e] [https://github.com/lauringlarner/Server_SOPRA/commit/b184093356c007f32bcca49336922312d3f65cc2] [https://github.com/lauringlarner/Server_SOPRA/commit/d45e8208aec48dc5707ae00fee8a026823074055]| [Performed refactoring on the UserService,UserController,LobbyService,LobbyController and AuthService. Implemented additional validation checks for open lobby and that the teams are non empty for the Lobby start endpoint. Corrected an oversight where the POST /lobbies and POST /lobbies/join endpoints didn't include the LobbyId] | [Refactoring helps keep the code "clean". Doing so corrects errors, inconsistent naming/validating and other undecided conventions from going unnoticed and keeping it up to date. We also removed lots of duplicate code and made the code more readable.] |

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
