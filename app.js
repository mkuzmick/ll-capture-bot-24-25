const { App } = require("@slack/bolt");
var path = require("path");
var fs = require("fs");
const llog = require("learninglab-log");
// const { getConfig } = require('./src/bots/config')
global.ROOT_DIR = path.resolve(__dirname);
const handleMessages = require("./src/bot/handlers/handle-messages");
const hijackWatcher = require("./src/bot/hijack-watcher")

require("dotenv").config({
  path: path.resolve(__dirname, `.env.${process.env.NODE_ENV}`),
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000,
});

app.message(/.*/, handleMessages.parseAll);


(async () => {

  if (!fs.existsSync("_temp")) {
    fs.mkdirSync("_temp");
  }
  if (!fs.existsSync("_output")) {
    fs.mkdirSync("_output");
  }
  await app.start(process.env.PORT || 3000);
  llog.yellow("⚡️ Bolt app is running!");

  let slackResult = await app.client.chat.postMessage({
    channel: process.env.SLACK_LOGGING_CHANNEL,
    text: "starting up the capture bot",
  });
  hijackWatcher({
    client: app.client, 
    watchFolder: process.env.HIJACK_WATCH_FOLDER,
    archiveFolder: process.env.HIJACK_ARCHIVE_FOLDER,
  });
})();
