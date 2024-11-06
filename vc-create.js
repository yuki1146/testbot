const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vc-create')
        .setDescription('指定されたカテゴリーにcreate-vcボイスチャンネルを作成します。')
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('ボイスチャンネルを作成するカテゴリーを選択してください。')
                .addChannelTypes(4) // カテゴリータイプ
                .setRequired(true)),
    async execute(interaction) {
        const category = interaction.options.getChannel('category');

        if (!category || category.type !== 'GUILD_CATEGORY') {
            return await interaction.reply({ content: '指定されたチャンネルはカテゴリーではありません。', ephemeral: true });
        }

        // create-vc チャンネルを作成
        const voiceChannel = await interaction.guild.channels.create('create-vc', {
            type: 'GUILD_VOICE',
            parent: category.id,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    allow: ['VIEW_CHANNEL'],
                },
            ],
        });

        await interaction.reply({ content: `「${voiceChannel.name}」が「${category.name}」カテゴリーに作成されました。`, ephemeral: true });

        // ボイスチャンネルの参加者を監視
        voiceChannel.createVoiceStateCollector({
            filter: (oldState, newState) => newState.channelId === voiceChannel.id && !newState.member.user.bot,
            dispose: (oldState) => oldState.channelId === voiceChannel.id
        }).on('collect', async (state) => {
            const member = state.member;
            const newChannelName = member.user.username;

            // 新しいボイスチャンネルを作成
            const tempVoiceChannel = await interaction.guild.channels.create(newChannelName, {
                type: 'GUILD_VOICE',
                parent: category.id,
                permissionOverwrites: voiceChannel.permissionOverwrites.cache.map(overwrite => ({
                    id: overwrite.id,
                    allow: overwrite.allow,
                    deny: overwrite.deny,
                })),
            });

            // ユーザーを新しいチャンネルに移動
            await member.voice.setChannel(tempVoiceChannel);

            // 一時的なボイスチャンネルのメンバー数を監視
            const collector = tempVoiceChannel.createVoiceStateCollector({
                filter: (oldState, newState) => newState.channelId === tempVoiceChannel.id || oldState.channelId === tempVoiceChannel.id
            });

            collector.on('end', async () => {
                if (tempVoiceChannel.members.size === 0) {
                    await tempVoiceChannel.delete();
                    console.log(`一時的なボイスチャンネル「${newChannelName}」を削除しました。`);
                }
            });
        });
    },
};
