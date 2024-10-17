var chokidar = require("chokidar");
const llog = require("learninglab-log");
const fs = require("fs");
const OpenAI = require("openai");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { App } = require("@slack/bolt");
const Replicate = require("replicate");
const axios = require('axios');
// const customConfig = require('../../custom/mod-hebrew');


// actual rainbowChannel
// const rainbowChannel = "C07K2TEFQFP"

// temp gened1145 as rainbow
const rainbowChannel = "C07T0GUUKC0"

// logs channel as rainbow 
// const rainbowChannel = "C07K2TEFQFP"


async function uploadImageToRainbow(client, scene, filename, imagePath, fileSizeInBytes, ts) {
  try {
      // Step 1: Get the upload URL
      const uploadUrlResponse = await client.files.getUploadURLExternal({
          channels: scene.channel,
          filename: filename,
          thread_ts: ts,
          length: fileSizeInBytes,
      });

      if (!uploadUrlResponse.ok) {
          console.error("Failed to get upload URL:", uploadUrlResponse.error);
          return;
      }

      console.log("Upload URL obtained successfully:", uploadUrlResponse);

      const uploadUrl = uploadUrlResponse.upload_url;
      const file_id = uploadUrlResponse.file_id;

      // Step 2: Upload the file content to the URL
      const fileStream = fs.createReadStream(imagePath);
      await axios.post(uploadUrl, fileStream, {
          headers: {
              'Content-Type': 'image/webp', // Adjust the content type based on the file type
              'Content-Length': fileSizeInBytes, // Include the file size in bytes
          },
      });

      console.log("Image content uploaded successfully to Slack's server.");

      // Step 3: Complete the upload process
      const completeUploadResponse = await client.files.completeUploadExternal({
          files: [
              {
                  id: file_id,
                  title: "Generated Image",
              },
          ],
          initial_comment: "I've created this image for you",
          channel_id: rainbowChannel,
          thread_ts: ts,
          channels: [rainbowChannel], // Ensure that the file is shared in the channel
      });

      if (!completeUploadResponse.ok) {
          console.error("Failed to complete file upload:", completeUploadResponse.error);
          return;
      }

      console.log("Image upload completed successfully:", completeUploadResponse);

      // Step 4: Log file information to verify its existence
      const fileInfoResponse = await client.files.info({
          file: file_id,
      });

      if (!fileInfoResponse.ok) {
          console.error("Failed to retrieve file info:", fileInfoResponse.error);
          return;
      }

      console.log("Retrieved file info:", fileInfoResponse);
  } catch (error) {
      console.error("An error occurred during the file upload process:", error);
  }
}


const tdmConfig = {
  scenes: [
    {
      name: "The Control Room",
      channel: "C07QLJSM81G",
      track: "a8k_03",
      color: "gray",
      icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06T3AKR886/red.webp?pub_secret=9c8372302a"
    },
    // {
    //   name: "main table",
    //   channel: "C07K2TEFQFP",
    //   track: "a8k_01",
    //   color: "gray",
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F07SKQ0TGU9/main_table.webp?pub_secret=48fa3168df"
    // },
    {
      name: "Small Studio",
      channel: "C07R9CSJNG0",
      track: "a8k_05",
      color: "green",
      // icon: "https://files.slack.com/files-pri/T0HTW3H0V-F07QP9S0NKF/dall__e_2024-10-07_14.03.03_-_a_retro-futuristic_small_studio_setup_in_a_field_of_vibrant_flowers__with_two_microphones_subtly_placed_in_front_of_a_green_or_black_backdrop._the_des-small-studio.webp?pub_secret=913c691b70"
    },
    // {
    //   name: "default",
    //   channel: "C07K2TEFQFP",
    //   track: "a8k_11",
    //   color: "gray"
    // },
    {
      name: "Main Stage",
      channel: "C07T0JG9J7J",
      track: "a8k_09",
      color: "red",
      icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06T3AKR886/red.webp?pub_secret=9c8372302a"
    },
    {
      name: "Main Table",
      channel: "C07T0J4RZ24",
      track: "a8k_07",
      color: "purple",
      icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06TCDDKGTE/purple.webp?pub_secret=95f7661c66"
    },
    // {
    //   name: "comp-lit-200-orange",
    //   channel: "C07RE2V1SDN",
    //   track: "a8k_09",
    //   color: "orange",
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06TYNY4G5N/orange.webp?pub_secret=b8a0aec13a"
    // },
    // {
    //   name: "comp-lit-200-yellow",
    //   channel: "C07QNCAU8LV",
    //   track: "a8k_05",
    //   color: "yellow",
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06SVCN5HK9/yellow.webp?pub_secret=8100e38384"
    // },
    // {
    //   name: "comp-lit-200-green",
    //   channel: "C07QTQ7MKFW",
    //   track: "a8k_10",
    //   color: "green",
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06SVCR9895/green.webp?pub_secret=ac944d3bd2"
    // },
    // {
    //   name: "main table",
    //   channel: "C07LRH22JGN",
    //   track: "a8k_01",
    //   color: "gray",
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F07QPAAE485/dall__e_2024-10-07_14.06.08_-_a_retro-futuristic_butcher_block_main_table_in_a_field_of_vibrant__multicolored_flowers__with_a_metal_base_and_colorful_markers__blank_paper_on_top-main-table.webp?pub_secret=6d037790f3"
    // },
    // {
    //   name: "comp-lit-200-blue",
    //   channel: "C07R40FDHB3",
    //   track: "a8k_07",
    //   color: "blue",
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06T3AHJ5ML/blue.webp?pub_secret=a5b1b2376e"
    // },
    // {
    //   name: "comp-lit-200-rainbow",
    //   channel: "C07RE3C3FQQ",
    //   track: "a8k_11",
    //   color: "rainbow"
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F07QUJRQQLU/dall__e_2024-10-07_13.53.48_-_a_retro-futuristic_computer_in_a_field_of_colorful_wildflowers_inspired_by_rainbow_hues__with_sleek_rounded_edges_and_a_subtle_rainbow_reflection_on_i-rainbow.webp?pub_secret=14aa4b557e"
    // },
  ]
};



const gened1145Config = {
  scenes: [
    {
      name: "control room",
      channel: "C07QLJSM81G",
      track: "a8k_03",
      color: "gray",
      icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06T3AKR886/red.webp?pub_secret=9c8372302a"
    },
    {
      name: "main table",
      channel: "C07K2TEFQFP",
      track: "a8k_01",
      color: "gray",
      icon: "https://files.slack.com/files-pri/T0HTW3H0V-F07SKQ0TGU9/main_table.webp?pub_secret=48fa3168df"
    },
    {
      name: "small studio",
      channel: "C07R9CSJNG0",
      track: "a8k_05",
      color: "green",
      // icon: "https://files.slack.com/files-pri/T0HTW3H0V-F07QP9S0NKF/dall__e_2024-10-07_14.03.03_-_a_retro-futuristic_small_studio_setup_in_a_field_of_vibrant_flowers__with_two_microphones_subtly_placed_in_front_of_a_green_or_black_backdrop._the_des-small-studio.webp?pub_secret=913c691b70"
    },
    // {
    //   name: "default",
    //   channel: "C07K2TEFQFP",
    //   track: "a8k_11",
    //   color: "gray"
    // },
    {
      name: "Camera Station Benshi",
      channel: "C07T0JG9J7J",
      track: "a8k_09",
      color: "red",
      icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06T3AKR886/red.webp?pub_secret=9c8372302a"
    },
    {
      name: "Paper Station Benshi",
      channel: "C07T0J4RZ24",
      track: "a8k_07",
      color: "purple",
      icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06TCDDKGTE/purple.webp?pub_secret=95f7661c66"
    },
    // {
    //   name: "comp-lit-200-orange",
    //   channel: "C07RE2V1SDN",
    //   track: "a8k_09",
    //   color: "orange",
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06TYNY4G5N/orange.webp?pub_secret=b8a0aec13a"
    // },
    // {
    //   name: "comp-lit-200-yellow",
    //   channel: "C07QNCAU8LV",
    //   track: "a8k_05",
    //   color: "yellow",
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06SVCN5HK9/yellow.webp?pub_secret=8100e38384"
    // },
    // {
    //   name: "comp-lit-200-green",
    //   channel: "C07QTQ7MKFW",
    //   track: "a8k_10",
    //   color: "green",
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06SVCR9895/green.webp?pub_secret=ac944d3bd2"
    // },
    // {
    //   name: "main table",
    //   channel: "C07LRH22JGN",
    //   track: "a8k_01",
    //   color: "gray",
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F07QPAAE485/dall__e_2024-10-07_14.06.08_-_a_retro-futuristic_butcher_block_main_table_in_a_field_of_vibrant__multicolored_flowers__with_a_metal_base_and_colorful_markers__blank_paper_on_top-main-table.webp?pub_secret=6d037790f3"
    // },
    // {
    //   name: "comp-lit-200-blue",
    //   channel: "C07R40FDHB3",
    //   track: "a8k_07",
    //   color: "blue",
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F06T3AHJ5ML/blue.webp?pub_secret=a5b1b2376e"
    // },
    // {
    //   name: "comp-lit-200-rainbow",
    //   channel: "C07RE3C3FQQ",
    //   track: "a8k_11",
    //   color: "rainbow"
    //   icon: "https://files.slack.com/files-pri/T0HTW3H0V-F07QUJRQQLU/dall__e_2024-10-07_13.53.48_-_a_retro-futuristic_computer_in_a_field_of_colorful_wildflowers_inspired_by_rainbow_hues__with_sleek_rounded_edges_and_a_subtle_rainbow_reflection_on_i-rainbow.webp?pub_secret=14aa4b557e"
    // },
  ]
};

const customConfig = gened1145Config;

const handleFile = (filePath) => {
  const fileName = path.basename(filePath, path.extname(filePath)); // Extract the file name without extension

  const matchingScene = customConfig.scenes.find(scene => fileName.includes(scene.track));

  if (matchingScene) {
    llog.magenta(`Sending ${fileName} to Slack channel: ${matchingScene.channel} (Scene: ${matchingScene.name})`);
    // Here you would send the message to Slack using the bot
    return matchingScene;
  } else {
    llog.red(`No matching scene found for ${fileName}`);
    return false;
  }
};


const hijackWatcher = async ({ client, watchFolder, archiveFolder }) => {


  llog.green(`watchFolder: ${watchFolder}`);
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  var watcher = chokidar.watch(watchFolder, {
    ignored: /\.DS_Store/,
    persistent: true,
    awaitWriteFinish: true,
  });

  watcher
    .on("add", async function (filePath) {
      let start = new Date().getTime();

      try {
        if (!/\.(mp3|mp4|m4v|aac)$/.test(filePath)) {
          throw new Error("Unsupported file format");
        }

        // Check file duration
        const getDuration = (filePath) => {
          return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
              if (err) return reject(err);
              const duration = metadata.format.duration;
              resolve(duration);
            });
          });
        };

        const duration = await getDuration(filePath);

        console.log("File", filePath, "has been added");
        llog.cyan(`Going to move ${filePath} to ${archiveFolder}`);

        const fileName = path.basename(filePath); // Extract the file name from the path
        const destPath = path.join(archiveFolder, fileName);

        // Move the file to the archive folder
        await fs.promises.rename(filePath, destPath);

        if (duration <= 3.5) {
          llog.yellow(
            `File ${filePath} is too short (${duration} seconds). Skipping transcription.`,
          );
          return;
        }

        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(destPath),
          model: "whisper-1",
        });

        console.log(transcription.text);

        const baseNameWithoutExtension = path.basename(
          destPath,
          path.extname(destPath),
        );
        const transcriptionJsonPath = path.join(
          path.dirname(destPath),
          baseNameWithoutExtension + ".json",
        );
        const transcriptionTxtPath = path.join(
          path.dirname(destPath),
          baseNameWithoutExtension + ".txt",
        );

        fs.writeFileSync(
          transcriptionJsonPath,
          JSON.stringify(transcription, null, 4),
        );
        fs.writeFileSync(transcriptionTxtPath, transcription.text);


        const scene = handleFile(filePath);


        if (!scene) {
          llog.red("No matching scene found. Exiting.");
          return;
        }

        llog.blue(scene)
        // Send transcription to Slack

        // if (scene) {


        // }

        const result = await client.chat.postMessage({
          channel: scene.channel,
          text: `${transcription.text}`,
          username: scene.name,
          icon_url: scene.icon ? scene.icon : null
        });

        const rainbowResult =  await client.chat.postMessage({
          channel: rainbowChannel,
          text: `${transcription.text}`,
          username: scene.name,
          icon_url: scene.icon ? scene.icon : null
        });


          

        const ts = result.ts; // Get the timestamp of the posted message


      
       

        const imagePromptResponse = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: `Please briefly describe what would be the best image to accompany a blog post or social post about the following conversation transcript:\n\n"${transcription.text}".` }
          ],
          max_tokens: 200,
        });

        const thePrompt = imagePromptResponse.choices[0].message.content.trim();

        const replicate = new Replicate({
          auth: process.env.REPLICATE_API_TOKEN,
        });

        const input = {
          prompt: thePrompt,
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 80
        };

        const output = await replicate.run("black-forest-labs/flux-schnell", { input });
        console.log(output);


        const timestamp = Date.now();
        const filename = `replicate_${timestamp}.webp`;
        const tempDir = path.join(global.ROOT_DIR, '_temp');
        const imagePath = path.join(tempDir, filename);

// Ensure the _temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }


        // Download the image using Axios
        const imageUrl = output[0];  // Assuming the first output URL is the image
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'arraybuffer',  // Ensure the response is in binary form
        });

        // Save the image to a file
        fs.writeFileSync(imagePath, response.data);

        console.log(`Image downloaded and saved to ${imagePath}`);

        const fileSizeInBytes = fs.statSync(imagePath).size;


                

                // Step 1: Get the upload URL
        const uploadUrlResponse = await client.files.getUploadURLExternal({
          channels: scene.channel,
          filename: filename,
          thread_ts: ts,
          length: fileSizeInBytes
        });

        if (!uploadUrlResponse.ok) {
          console.error("Failed to get upload URL:", uploadUrlResponse.error);
          return;
        }

        console.log("Upload URL obtained successfully:", uploadUrlResponse);

        const uploadUrl = uploadUrlResponse.upload_url;
        const file_id = uploadUrlResponse.file_id;

        const fileStream = fs.createReadStream(imagePath);
        // Step 2: Upload the file content to the URL
        await axios.post(uploadUrl, fileStream, {
          headers: {
              'Content-Type': 'image/webp', // Adjust the content type based on the file type
              'Content-Length': fileSizeInBytes  // Include the file size in bytes
          },
      });
      

        console.log("Image content uploaded successfully to Slack's server.");

        // Step 3: Complete the upload process
        

        const completeUploadResponse = await client.files.completeUploadExternal({
          files: [
              {
                  id: file_id,
                  title: "Generated Image"
              }
          ],
          initial_comment: "I've created this image for you",
          channel_id: scene.channel,
          thread_ts: ts,
          // Ensure that the file is shared in the channel
          channels: [scene.channel]
      });

      


        if (!completeUploadResponse.ok) {
          console.error("Failed to complete file upload:", completeUploadResponse.error);
          return;
        }

        llog.blue("Image upload completed successfully:", completeUploadResponse);

        // Step 4: Log file information to verify its existence
        const fileInfoResponse = await client.files.info({
          file: file_id
        });

        if (!fileInfoResponse.ok) {
          console.error("Failed to retrieve file info:", fileInfoResponse.error);
          return;
        }

        console.log("Retrieved file info:", fileInfoResponse);


        const rainbowImageResult = await uploadImageToRainbow(client, scene, filename, imagePath, fileSizeInBytes, rainbowResult.ts)







        const initialResponse = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
              { role: "system", content: "You are a helpful assistant" },
              { role: "user", content: `can you please translate this into japanese and when making stylistic choices, try to say what a dramatic Benshi might say if he were delivering this content to describe a silent film: "${transcription.text}" Return only what the Benshi would say, nothing else.` }
          ],
          max_tokens: 1000,
        });

        const responseText = initialResponse.choices[0].message.content.trim();

        await client.chat.postMessage({
          channel: scene.channel,
          text: responseText,
          thread_ts: ts,
          username: "AI Benshi",
          icon_url: "https://files.slack.com/files-pri/T0HTW3H0V-F06SVCR9895/green.webp?pub_secret=ac944d3bd2"
        });


        const response2 = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
              { role: "system", content: "You are a historian of Japanese Cinema" },
              { role: "user", content: `Can you please translate this text, spoken by a Japanese Benshi as he described a film, and then try to analyze what the possible film might have been about and why it is significant? The film itself is lost, we have only this record of what the Benshi said: "${responseText}"` }
          ],
          max_tokens: 1000,
        });

        const response2Text = response2.choices[0].message.content.trim();

        await client.chat.postMessage({
          channel: scene.channel,
          text: response2Text,
          thread_ts: ts,
          username: "English Translator",
          icon_url: "https://files.slack.com/files-pri/T0HTW3H0V-F06TYNY4G5N/orange.webp?pub_secret=b8a0aec13a"
        });



        let stop = new Date().getTime();
        let durationInMilliseconds = stop - start;
        console.log(`Request took ${durationInMilliseconds} milliseconds`);
      } catch (error) {
        console.error("An error occurred:", error);
      }

      return { status: "complete" };
    })
    .on("change", function (filePath) {
      console.log("File", filePath, "has been changed");
    })
    .on("unlink", function (filePath) {
      console.log("File", filePath, "has been removed");
    })
    .on("error", function (error) {
      console.error("Error happened", error);
    });
};

module.exports = hijackWatcher;
