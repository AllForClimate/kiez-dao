const { proposals } = require('../modules/tables.js');
const { getTodayString, permlevel } = require('../modules/functions.js');
const { majorityVote } = require('../modules/voting.js');
const { MessageActionRow, MessageButton } = require("discord.js");

exports.run = async (client, interaction) => {
  await interaction.deferReply({ ephemeral: true });

  try {
    const proposal_text = interaction.options.getString('proposal');
    const voting_type = interaction.options.getString('voting type');

    // Post the claim in the "claims" channel for admins to approve or deny
    const proposalsChannel = client.channels.cache.find(channel => channel.name == 'proposals');
    const buttons = new MessageActionRow()
      .addComponents([
      new MessageButton()
        .setCustomId('yes')
        .setLabel('Yay')
        .setStyle('SUCCESS'),
      new MessageButton()
        .setCustomId('no')
        .setLabel('Nay')
        .setStyle('DANGER')
      ])
    
    const proposal_message_content = `${interaction.user.username} has made the following proposal: \n ${proposal_text}`;
    const proposalMessage = await proposalsChannel.send({
      content: proposal_message_content,
      components: [buttons]});

    // only register votes roles above a certain level
    const roleFilter = i => permlevel(i) >= 3;
    const collector = proposalMessage.createMessageComponentCollector({ filter: roleFilter, time: 1*1000*10 });

    // Keep record of votes so users can change their vote
    let yes_votes = new Set;
    let no_votes = new Set;
    let id_name_mapping = new Map;

    collector.on('collect', i => {
      const decision = i.customId;
      const voterId = i.user.id;
      const voterName = i.user.username;
      id_name_mapping.set(voterId, voterName);
      console.log(`Collected ${decision} from ${voterName}`);

      if (decision === 'yes') {
        yes_votes.add(voterId);
        
        // if previously voted no, remove the no vote
        if (no_votes.has(voterId)) {
          no_votes.delete(voterId);
        }
      } else {
        no_votes.add(voterId);
        
        // if previously voted no, remove the no vote
        if (yes_votes.has(voterId)) {
          yes_votes.delete(voterId);
        }
      }

      console.log(yes_votes);
      console.log(no_votes);

      i.update({
        content: proposal_message_content + `\n Tally so far: \n ${yes_votes.size} yay | ${no_votes.size} nay`,
        components: [buttons]
      });
    });

    collector.on('end', async collected => {

      key = getTodayString();
      let decision;

      // get decision based on voting type chosen
      switch (voting_type) {
        case 'majority':
          decision = majorityVote(yes_votes, no_votes, proposalMessage);
        
        default: // defaults to majority
          decision = majorityVote(yes_votes, no_votes, proposalMessage);
      }

      // Add voter username alongside the ID for better human inspection
      const yes_voters = Array(yes_votes).map((id) => {
        return [id, id_name_mapping.get(id)]
      });

      const no_voters = Array(no_votes).map((id) => {
        return [id, id_name_mapping.get(id)]
      });
      
      // Create proposal record and add to proposals Enmap
      if (proposals.has(key)) {
        today_proposals = proposals.get(key);
        numeric_indexes = Array.from(Object.keys(today_proposals)).map((num) => Number(num));
        // get largest existing proposal ID for today's date
        current_count = Math.max(...numeric_indexes);
        counter = current_count + 1;
        proposal_record = {
          [counter]: {
            'proposal': proposal_text,
            'decision': decision,
            'yesCount': yes_vote_count,
            'noCount': no_vote_count,
            'yesVoters': yes_voters,
            'noVoters': no_voters
          }
        };
        today_proposals = Object.assign(today_proposals, proposal_record);
      } else {
        today_proposals = {
          0: {
            'proposal': proposal_text,
            'decision': decision,
            'yesCount': yes_vote_count,
            'noCount': no_vote_count,
            'yesVoters': yes_voters,
            'noVoters': no_voters
          }
        };
      }
      interaction.deleteReply();
      proposals.set(key, today_proposals);
      console.log(proposals);
    });
  } catch (error) {
      console.log(error);
  }
};

exports.commandData = {
  name: "propose",
  description: "Create a proposal for the community to vote on.",
  options: [
    {
      name: "proposal",
      description: "What is your proposal?",
      type: 3, // type 3 == string
      required: true
    },
    {
      name: "amount",
      description: "If proposal carries a budget requirement, provide required budget.",
      type: 4, // type 4 == int
      required: false
    },
    {
      name: "voting",
      description: "Which type of voting mechanism should be used?",
      type: 3,
      required: false,
      choices: [
        {
          name: 'majority',
          value: 'majority'
        }
      ]
    }
  ],
  defaultPermission: true,
};

exports.conf = {
  enabled: true,
  guildOnly: true,
  aliases: [],
  permLevel: "User"
};