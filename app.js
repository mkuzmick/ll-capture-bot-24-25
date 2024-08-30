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

// app.command("/update", bots.timespanSummaryBot.slash);
// app.command("/hackmd", slashHandlers.hackmd);
// app.command("/report", slashHandlers.report);
// app.command("/watch", slashHandlers.watch);

// app.view(/timespan_summary_submission/, bots.timespanSummaryBot.viewSubmission);
// app.action()

// app.message("testing testing", messageHandlers.testing);
app.message(/.*/, handleMessages.parseAll);
// app.message(process.env.SLACK_BOT_SLACK_ID, bots.updatesBot.mentioned);

// app.event("reaction_added", handleEvents.reactionAdded);
// app.event("reaction_removed", handleEvents.reactionRemoved);

(async () => {
//    const config = await getConfig([
//     {
//       name: "Users",
//       fields: ["Name", "SlackId"]
//     },
//     {
//       name: "Channels",
//       fields: ["ChannelId", "Name", "Description", "CustomFunctions", "CustomFunctionNames"]
//     },
//     {
//       name: "Functions",
//       fields: ["Name", "Notes"]
//     },
//   ])

  

//   llog.yellow(config);


//   config.Users.forEach(user => {
//     if (Array.isArray(user.SlackId) && user.SlackId.length > 0) {
//         user.SlackId = user.SlackId[0];
//     }
//   });
  


//   global.BOT_CONFIG = config;

//   llog.blue(global.BOT_CONFIG)
  // Check for folders
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
    watchFolder: process.env.HIJACK_WATCH_FOLDER,
    archiveFolder: process.env.HIJACK_ARCHIVE_FOLDER,
  });
})();
