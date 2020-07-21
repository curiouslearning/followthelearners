# followthelearners
## Setup testing environment
1. Clone the repo to your local machine
2. Add the `test_database` and `keys` directories provided by Curious Learning to the top level of the project
3. Open a terminal instance and navigate to followthelearners
4. Run the command `firebase init` and follow the instructions in the CLI
5. Update the firebase emulator path: `export FIRESTORE_EMULATOR_HOST="localhost:8080"`
  5a. NOTE: you must execute this command in each new terminal instance/window, or add this to your bashrc or .zprofile. Otherwise the app will hit production servers!
6. Run the command `firebase emulators:start --load=./test_datbase
7. Follow any instructions for configuring the emulators. Make sure "Firestore Emulator" and "Cloud Functions Emulator" are enabled!
8. Navigate to the address configured for the emulator suite (most likely "localhost:4000/") in a web browser to ensure the emulator is running and the database has been imported
9. To run follow the learners on a localhost while connected to the firebase emulator suite, open a new terminal instance and run `node index.js` (make sure the FIRESTORE_EMULATOR_HOST path is set!)
10. Navigate to localhost:3000 in a web browser to view the project
