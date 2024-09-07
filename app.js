const { Telegraf, session } = require('telegraf');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const axios = require("axios")
const bot = new Telegraf(process.env.BOT_TOKEN);
const channelId = process.env.CHANNEL_ID;
const ownerId = parseInt(process.env.OWNER_ID, 10);
const ownerID = process.env.OWNER_ID;
// Data storage
const usersFilePath = path.join(__dirname, 'users.json');
const userIDs = loadData('users.json') || [];
const admins = loadData('admins.json') || [];
const requiredChannels = loadData('required_channels.json') || [];
const requiredGroups = loadData('required_groups.json') || [];
const messageStats = loadData('message_stats.json') || {};

// Define the specific username you want to check
const specificUsername = '@blackholetm';


// Function to handle viewing channels
async function handleViewChannels(ctx) {
  const channelList = requiredChannels.length ? requiredChannels.join('\n') : 'No channels required';
  await ctx.answerCbQuery(); // Answer the callback query to acknowledge the action
  await ctx.reply(`Current Channels:\n${channelList}`);
}




// Load scores from JSON file
function loadScores() {
    if (!fs.existsSync('scores.json')) {
        return {}; // Return an empty object if no file exists yet
    }
    return JSON.parse(fs.readFileSync('scores.json', 'utf-8'));
}

// Save scores to JSON file
function saveScores(scores) {
    fs.writeFileSync('scores.json', JSON.stringify(scores, null, 2));
}

// Increment score for a user
function incrementScore(userId) {
    const scores = loadScores();
    if (!scores[userId]) {
        scores[userId] = 0; // Initialize score if user doesn't have one yet
    }
    scores[userId] += 1;
    saveScores(scores);
}

// Get score for a user
function getScore(userId) {
    const scores = loadScores();
    return scores[userId] || 0; // Return 0 if the user has no score yet
}




// Function to handle viewing groups
async function handleViewGroups(ctx) {
  const groupList = requiredGroups.length ? requiredGroups.join('\n') : 'No groups required';
  await ctx.answerCbQuery(); // Answer the callback query to acknowledge the action
  await ctx.reply(`Current Groups:\n${groupList}`);
}

// Function to check if a user is a member of required channels and groups
const checkMembership = async (ctx) => {
  for (const channel of requiredChannels) {
    try {
      const member = await bot.telegram.getChatMember(channel, ctx.from.id);
      if (member.status !== 'member' && member.status !== 'administrator' && member.status !== 'creator') {
        return false;
      }
    } catch (error) {
      console.error('Error checking channel membership:', error);
      return false;
    }
  }
  for (const group of requiredGroups) {
    try {
      const member = await bot.telegram.getChatMember(group, ctx.from.id);
      if (member.status !== 'member' && member.status !== 'administrator' && member.status !== 'creator') {
        return false;
      }
    } catch (error) {
      console.error('Error checking group membership:', error);
      return false;
    }
  }
  return true;
};


// Initialize currentOperation
const currentOperation = {};

// Load data from JSON file
function loadData(filename) {
  const filepath = path.join(__dirname, filename);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  }
  return [];
}

// Enable session middleware
bot.use(session());

// Function to sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// Function to create a progress bar animation
async function sendProgressBar(ctx, messageId) {
  const steps = 100; // More steps for smoother animation
  const barLength = 20; // Length of the progress bar
  for (let i = 1; i <= steps; i++) {
      const progress = Math.round((i / steps) * 100);
      const filledBar = '█'.repeat(Math.round((i / steps) * barLength));
      const emptyBar = '░'.repeat(barLength - filledBar.length);
      const progressBar = `Progress: [${filledBar}${emptyBar}] ${progress}%`;

      if (i % 5 === 0 || i === steps) { // Update every 5% for smoother effect
          await bot.telegram.editMessageText(ctx.chat.id, messageId, null, progressBar);
      }

      await sleep(50); // Adjust the speed of the animation here
  }
}

// Generalized function to handle progress bar for both replacing and sending files
async function handleProgressBar(ctx, operationType) {
  const initialMessage = await ctx.reply(`${operationType} file: [░░░░░░░░░░░░░░░░░░] 0%`);
  await sendProgressBar(ctx, initialMessage.message_id);
  await bot.telegram.deleteMessage(ctx.chat.id, initialMessage.message_id);
}


// Save data to JSON file
function saveData(filename, data) {
  fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(data, null, 2));
}

// Helper function to check if user is an admin or owner
const isAdminOrOwner = (userID) => {
  console.log('Checking if user is admin or owner...');
  console.log('User ID:', userID);
  console.log('Admins:', admins);
  console.log('Owner ID:', ownerId);

  // Convert userID to string for comparison
  const stringUserID = String(userID);

  return admins.includes(stringUserID) || stringUserID === String(ownerId);
};



// Function to format timestamp for readability
const formatDate = (date) => new Date(date).toLocaleString();

// Function to format URLs correctly
const formatLinkv2 = (link) => {
  if (link.startsWith('@')) {
    return `https://t.me/${link.slice(1)}`;
  }
  return link;
};

// Start command
bot.start(async (ctx) => {
  const userID = ctx.from.id;
  const args = ctx.message.text.split(' '); // For checking referral

  // If the user joined with a referral ID
  if (args.length > 1 && !isNaN(args[1])) {
    const referrerID = parseInt(args[1]);

    // Add 1 score to the referrer
    if (referrerID !== userID & !userIDs.includes(userID)) { // Prevent self-referral
      incrementScore(referrerID);

      // Send a notification to the referrer about the new referral
      try {
        await bot.telegram.sendMessage(referrerID, `🎉 Tabreklaymiz sizning havolangiz orqali kimdir botga kirdi ☺️\n\nSiz 1 ball qo'lga kiritdingiz 🪙`, { parse_mode: 'Markdown' });
      } catch (error) {
        console.log(`Failed to notify referrer (ID: ${referrerID}): ${error.message}`);
      }
    }
  }

  // Add user to the list if not already included
  if (!userIDs.includes(userID)) {
    userIDs.push(userID);
    saveData('users.json', userIDs);
  }

  // Create the referral link with the user's ID
  const referralLink = `https://t.me/${ctx.botInfo.username}?start=${userID}`;

  // Check if user is a member of the required channels and groups
  if (await checkMembership(ctx)) {
    // Path to the image file you want to send
    const imagePath = './photos/icon_photo.jpg'; // Update this path

    // Read and send the image along with the referral link
    await ctx.replyWithPhoto(
      { source: fs.createReadStream(imagePath) },
      { caption: `Botimizga xush kelibsiz🤠\n\nBu sizning havolangiz:\n${referralLink}\n Bu havolani do'stlaringizga ulashib ball yig'ishingiz kerak 🪙\nAgar siz 15 ball yig'ib bo'lsangiz, bizning Neuroscience darslarimiz uchun maxsus link qo'lga kiritasiz 🔗\nBallni aniqlash: /score\nLinkni olish: /link`}
    );
  } else {
    // Generate channel and group buttons with labels
    const channelLinks = requiredChannels.map((link, index) => ({
      text: `Channel ${index + 1}`,
      url: formatLinkv2(link) // Ensure URL is correctly formatted
    }));
    const groupLinks = requiredGroups.map((link, index) => ({
      text: `Group ${index + 1}`,
      url: formatLinkv2(link) // Ensure URL is correctly formatted
    }));
    const buttonsPerRow = 2; // Adjust this number if needed

    // Combine all buttons and organize them into rows
    const allButtons = [...channelLinks, ...groupLinks];
    const chunkArray = (array, size) => {
      const result = [];
      for (let i = 0; i < array.length; i += size);
      result.push(array.slice(i, i + size));
    };
    const inlineKeyboard = chunkArray(allButtons, buttonsPerRow);

    // Send message with organized inline keyboard
    await ctx.reply(
      "❌ Sorry, you need to join these channels and groups before using the bot:",
      {
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      }
    );
  }
});
  
bot.command('link', async (ctx) => {
  const userID = ctx.from.id;
  const score = getScore(userID);

  if (score >= 15) {
    await ctx.reply("Tabreklaymiz! Sizda maxsus link uchun yetarlicha ball mavjud. Maxsus link: https://t.me/+WC8Ris6nvYg4MGMy", { parse_mode: 'Markdown' });
  } else {
    await ctx.reply("You need at least 15 points to access the premium link.", { parse_mode: 'Markdown' });
  }
});
bot.command('score', async (ctx) => {
    const userID = ctx.from.id;
    const score = getScore(userID);

    await ctx.reply("Your balance: " + score)
});

// Command to replace files
bot.command('replace', (ctx) => {
  if (ctx.from.id.toString() === ownerID) {
      ctx.reply('Please upload the JSON file you want to replace (only users.json).');
  } else {
      ctx.reply('You are not authorized to use this command.');
  }
});






// Admin panel command
bot.command('adminpanel', async (ctx) => {
  const userID = ctx.from.id;
  if (isAdminOrOwner(userID)) {
    const adminPanelButtons = [
      [{ text: 'View Total Users', callback_data: 'view_total_users' }, { text: 'View Admins', callback_data: 'view_admins' }],
      [{ text: 'Add Channel', callback_data: 'add_channel' }, { text: 'Remove Channel', callback_data: 'remove_channel' }],
      [{ text: 'Add Group', callback_data: 'add_group' }, { text: 'Remove Group', callback_data: 'remove_group' }],
      [{ text: 'Send Message', callback_data: 'send_message' }], [{ text: 'View Channels', callback_data: 'view_channels' }, { text: 'View Groups', callback_data: 'view_groups' }],
    ];

    if (userID === ownerId) {
      adminPanelButtons.unshift(
        [{ text: 'Add Admin', callback_data: 'add_admin' }, { text: 'Remove Admin', callback_data: 'remove_admin' }]
      );
    }

    await ctx.reply('Admin Panel:', {
      reply_markup: {
        inline_keyboard: adminPanelButtons
      }
    });
  } else {
    await ctx.reply('You do not have permission to access the admin panel.');
  }
});


bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userID = ctx.from.id;

  try {
    // Split data for actions related to movies
    const [action, movieIdStr] = data.split('_');
    const movieId = parseInt(movieIdStr, 10);

    if (action === 'toggle') {
      // Toggle saving movies
      if (!userSavedMovies[userID]) {
        userSavedMovies[userID] = [];
      }

      if (userSavedMovies[userID].includes(movieId)) {
        userSavedMovies[userID] = userSavedMovies[userID].filter(id => id !== movieId);
        await ctx.answerCbQuery('Movie removed from saved list.');
      } else {
        userSavedMovies[userID].push(movieId);
        await ctx.answerCbQuery('Movie saved successfully!');
      }

      saveData('userSavedMovies.json', userSavedMovies);
      console.log(`Updated userSavedMovies for ${userID}: ${JSON.stringify(userSavedMovies[userID])}`);

    } else if (data === 'view_total_users') {
      const totalUsers = userIDs.length;
      const activeUsers = messageStats.activeUsers || 0;
      const inactiveUsers = messageStats.inactiveUsers || 0;
      const lastUpdated = formatDate(messageStats.lastUpdated || new Date());

      await ctx.reply(`Total Users: ${totalUsers}\nActive Users: ${activeUsers}\nInactive Users: ${inactiveUsers}\nLast Updated: ${lastUpdated}`);

    } else if (data === 'view_admins') {
      const adminList = admins.length ? admins.join('\n') : 'No admins available';
      await ctx.reply(`Admin IDs:\n${adminList}`);

    } else if (data === 'add_admin' && userID === ownerId) {
      currentOperation[userID] = { type: 'add_admin', messageId: null };
      const sentMessage = await ctx.reply('Please send the user ID to add as an admin:', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]]
        }
      });
      currentOperation[userID].messageId = sentMessage.message_id;

    } else if (data === 'remove_admin' && userID === ownerId) {
      currentOperation[userID] = { type: 'remove_admin', messageId: null };
      const sentMessage = await ctx.reply('Please send the user ID to remove from admins:', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]]
        }
      });
      currentOperation[userID].messageId = sentMessage.message_id;

    } else if (['add_channel', 'remove_channel', 'add_group', 'remove_group'].includes(data)) {
      if (isAdminOrOwner(userID)) {
        currentOperation[userID] = { type: data, messageId: null };
        let prompt = '';

        if (data === 'add_channel') {
          prompt = 'Please send the channel username (e.g., @channelusername) to add:';
        } else if (data === 'remove_channel') {
          prompt = 'Please send the channel username (e.g., @channelusername) to remove:';
        } else if (data === 'add_group') {
          prompt = 'Please send the group username (e.g., @groupusername) to add:';
        } else if (data === 'remove_group') {
          prompt = 'Please send the group username (e.g., @groupusername) to remove:';
        }

        const sentMessage = await ctx.reply(prompt, {
          reply_markup: {
            inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]]
          }
        });
        currentOperation[userID].messageId = sentMessage.message_id;
      }

    } else if (data === 'send_message' && isAdminOrOwner(userID)) {
      currentOperation[userID] = { type: 'send_message', messageId: null };
      const sentMessage = await ctx.reply('Please send the message to be forwarded to all users:', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]]
        }
      });
      currentOperation[userID].messageId = sentMessage.message_id;

    } else if (data === 'cancel') {
      if (currentOperation[userID] && currentOperation[userID].messageId) {
        try {
          await ctx.deleteMessage(currentOperation[userID].messageId);
        } catch (err) {
          console.error('Failed to delete message:', err);
        }
        delete currentOperation[userID];
        await ctx.reply('Operation cancelled.');
      }

    } else if (data === 'view_channels') {
      await handleViewChannels(ctx);

    } else if (data === 'view_groups') {
      await handleViewGroups(ctx);

    } else if (data === 'cancel_operation') {
      if (currentOperation[userID]) {
        const lastMessageId = currentOperation[userID].lastMessageId;
        await ctx.deleteMessage(lastMessageId); // Delete the last message
        delete currentOperation[userID];
        await ctx.reply('Operation cancelled.');
      }
    }
  } catch (error) {
    console.error('Error handling callback query:', error);
    await ctx.answerCbQuery('Something went wrong, please try again.');
  }
});











bot.on('document', async (ctx) => {
  if (ctx.from.id.toString() !== ownerID) {
      return;
  }

  const fileName = ctx.message.document.file_name;
  const fileId = ctx.message.document.file_id;

  if (fileName !== 'users.json') {
      ctx.reply('Please upload a valid file (users.json).');
      return;
  }

  try {
      const fileLink = await bot.telegram.getFileLink(fileId);
      const response = await fetch(fileLink.href);
      const data = await response.json();

      const filePath = usersFilePath;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

      // Handle the progress bar animation for file replacement
      await handleProgressBar(ctx, "Replacing");

      // Send the final success message
      ctx.reply(`${fileName} has been replaced successfully.`);
  } catch (error) {
      console.error('Error replacing the file:', error);
      ctx.reply('There was an error replacing the file.');
  }
});

// Command to send files to the bot owner
bot.command('sendfiles', async (ctx) => {
  if (ctx.from.id.toString() === ownerID) {
      try {
          // Handle the progress bar animation for sending files
          await handleProgressBar(ctx, "Sending");


          // Send users.json
          if (fs.existsSync(usersFilePath)) {
              await ctx.telegram.sendDocument(ownerId, {
                  source: usersFilePath,
                  filename: 'users.json'
              });
          } else {
              await ctx.reply("The file `users.json` doesn't exist.");
          }

          // Send final success message
          ctx.reply('Files sent successfully!');
      } catch (error) {
          console.error('Error sending files:', error);
          ctx.reply('An error occurred while sending the files.');
      }
  } else {
      ctx.reply('You are not authorized to use this command.');
  }
});


// Handle incoming messages
bot.on('message', async (ctx) => {
  const userID = ctx.from.id;

  if (currentOperation[userID]) {
    const operation = currentOperation[userID];
    
    try {
      if (operation.type === 'add_admin') {
        if (!admins.includes(ctx.message.text)) {
          admins.push(ctx.message.text);
          saveData('admins.json', admins);
          await ctx.reply('Admin added successfully.');
        } else {
          await ctx.reply('User is already an admin.');
        }
      } else if (operation.type === 'remove_admin') {
        const index = admins.indexOf(ctx.message.text);
        if (index > -1) {
          admins.splice(index, 1);
          saveData('admins.json', admins);
          await ctx.reply('Admin removed successfully.');
        } else {
          await ctx.reply('User is not an admin.');
        }
      } else if (operation.type === 'add_channel') {
        if (!requiredChannels.includes(ctx.message.text)) {
          requiredChannels.push(ctx.message.text);
          saveData('required_channels.json', requiredChannels);
          await ctx.reply('Channel added successfully.');
        } else {
          await ctx.reply('Channel is already in the list.');
        }
      } else if (operation.type === 'remove_channel') {
        const index = requiredChannels.indexOf(ctx.message.text);
        if (index > -1) {
          requiredChannels.splice(index, 1);
          saveData('required_channels.json', requiredChannels);
          await ctx.reply('Channel removed successfully.');
        } else {
          await ctx.reply('Channel is not in the list.');
        }
      } else if (operation.type === 'add_group') {
        if (!requiredGroups.includes(ctx.message.text)) {
          requiredGroups.push(ctx.message.text);
          saveData('required_groups.json', requiredGroups);
          await ctx.reply('Group added successfully.');
        } else {
          await ctx.reply('Group is already in the list.');
        }
      } else if (operation.type === 'remove_group') {
        const index = requiredGroups.indexOf(ctx.message.text);
        if (index > -1) {
          requiredGroups.splice(index, 1);
          saveData('required_groups.json', requiredGroups);
          await ctx.reply('Group removed successfully.');
        } else {
          await ctx.reply('Group is not in the list.');
        }
      } else if (operation.type === 'send_message') {
          let totalSent = 0;
          let successfulDeliveries = 0;
          let failedDeliveries = 0;
          let activeUsers = 0;
          let inactiveUsers = 0;
      
          // Reset the message statistics before sending a new message
          messageStats.totalSent = 0;
          messageStats.successfulDeliveries = 0;
          messageStats.failedDeliveries = 0;
          messageStats.activeUsers = 0;
          messageStats.inactiveUsers = 0;
      
          for (const id of userIDs) {
              try {
                  await bot.telegram.forwardMessage(id, ctx.message.chat.id, ctx.message.message_id);
                  totalSent++;
                  successfulDeliveries++;
                  activeUsers++;
              } catch (e) {
                  totalSent++;
                  failedDeliveries++;
                  inactiveUsers++;
              }
          }
      
          // Update the statistics with the current operation's results
          messageStats.totalSent = totalSent;
          messageStats.successfulDeliveries = successfulDeliveries;
          messageStats.failedDeliveries = failedDeliveries;
          messageStats.activeUsers = activeUsers;
          messageStats.inactiveUsers = inactiveUsers;
          messageStats.lastUpdated = new Date();
      
          saveData('message_stats.json', messageStats);
      
          await ctx.reply(`Message sent.\nTotal Sent: ${totalSent}\nSuccessful Deliveries: ${successfulDeliveries}\nFailed Deliveries: ${failedDeliveries}\nLast Updated: ${formatDate(messageStats.lastUpdated)}`);
      
          delete currentOperation[userID];
      }
    } catch (error) {
      console.error('Error handling message:', error);
      await ctx.reply('An error occurred while processing your request.');
    }
  } else if (ctx.message.forward_from) {
    const message = ctx.message;
    for (const id of userIDs) {
      try {
        await bot.telegram.forwardMessage(id, message.chat.id, message.message_id);
      } catch (error) {
        console.error(`Failed to forward message to user ${id}:`, error);
      }
    }
  }
});

// Launch the bot only once
bot.launch()
    .then(() => console.log('Bot is running'))
    .catch((err) => console.error('Failed to launch bot:', err));