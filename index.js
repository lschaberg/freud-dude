// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { token } = require('./config.json');
const ytdl = require('ytdl-core');
const voice = require('@discordjs/voice');
const { YouTube } = require('youtube-sr');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });
const queue = new Map();
const timeoutIDs = new Map();

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, async c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) {
        return;
    }

    const command = message.content.match(/^!(\w*)\b/);
    if (command) {
        switch(command[1]) {
            case 'echo': {
                message.channel.send(message.content.slice(command[0].length));
                break;
            }
            case 'play': {
                clearTimeout(timeoutIDs.get(message.guildId));
                const connection = voice.getVoiceConnection(message.guildId);
                if (connection && connection.state.subscription.player.state.status !== voice.AudioPlayerStatus.Idle) {
                    data = await messageToData(message);
                    const serverQueue = queue.get(message.guildId) || [];
                    serverQueue.push(data);
                    queue.set(message.guildId, serverQueue);
                    message.channel.send(`Queueing in position ${serverQueue.length}: ${data.wasUrl ? data.title : data.url} (${data.durationFormatted})`)
                } else {
                    playYT(message);
                }
                break;
            }
            case 'pause': {
                const connection = voice.getVoiceConnection(message.guildId);
                if (connection) {
                    connection.state.subscription.player.pause();
                }
                break;
            }
            case 'unpause': {
                const connection = voice.getVoiceConnection(message.guildId);
                if (connection) {
                    connection.state.subscription.player.unpause();
                }
                break;
            }
            case 'skip': {
                const connection = voice.getVoiceConnection(message.guildId);
                if (connection) {
                    connection.state.subscription.player.stop();
                }
                break;
            }
            case 'stop': {
                const connection = voice.getVoiceConnection(message.guildId);
                if (connection) {
                    queue.set(message.guildId, []);
                    connection.state.subscription.player.stop();
                }
                break;
            }
            case 'clear': {
                queue.set(message.guildId, []);
                break;
            }
            case 'queue': {
                const serverQueue = queue.get(message.guildId);
                if (!serverQueue || serverQueue.length === 0) {
                    message.channel.send("Queue is currently empty.");
                } else {
                    let queueEmbed = new EmbedBuilder().setTitle("Queue contents:");
                    serverQueue.forEach((data, index) => {
                        //queueMessage = queueMessage.concat(`\n${index + 1}: ${data.title} (${data.durationFormatted})`);
                        queueEmbed = queueEmbed.addFields({"name": "\u200B", "value": `${index+1}. [${data.title}](${data.url}) (${data.durationFormatted})`});
                    });
                    message.channel.send({embeds: [queueEmbed]});
                }
            }
        }
    }
});  

const playYT = async (message) => {
    const data = await messageToData(message);
    console.log(data.url);
    message.channel.send(`Now playing: ${data.wasUrl ? data.title : data.url} (${data.durationFormatted})`);

    let stream = ytdl(data.url, {filter: 'audioonly'});

    const author = await message.guild.members.fetch(message.author.id);
    const voiceChannel = author.voice.channel;
    if (!voiceChannel) {
        return message.channel.send("You appear not to be in a voice channel. Did you perchance have a dream of being eaten by one?");
    }
    
    let resource = voice.createAudioResource(stream);

    const player = voice.createAudioPlayer();
    const connection = voice.joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guildId,
        adapterCreator: message.guild.voiceAdapterCreator,
    })
    player.play(resource);
    connection.subscribe(player);
    player.on(voice.AudioPlayerStatus.Idle, () => {
        const serverQueue = queue.get(message.guildId) || [];
        if (serverQueue.length > 0) {
            stream = ytdl(serverQueue.shift().url, {filter: 'audioonly'});
            resource = voice.createAudioResource(stream);
            player.play(resource);
        } else {
            timeoutIDs.set(message.guildId, setTimeout(() => {
                connection.destroy();
            }, 5 * 60 * 1000));
        }
    })
}

const messageToData = async (message) => {
    const query = message.content.slice(5).trim()
    if (ytdl.validateURL(query)) {
        const data = await YouTube.getVideo(query);
        data.wasUrl = true;
        return data;
    }
    const data = await YouTube.searchOne(query);
    data.wasUrl = false;
    return data;
}

// Log in to Discord with your client's token
client.login(token);
