const axios = require("axios");
const debug = require("debug")("slash-command-template:card");
const qs = require("querystring");
const users = require("./users");
const Clubhouse1 = require("clubhouse-lib");

// Production

const clubhouse = Clubhouse1.create("API KEY"); // ASU ACCOUNT API TOKEN

const labels = {
  design: { external_id: "53", name: "design" },
  "design-debt": { external_id: "19169", name: "design-deb" },
  "design-assist": { external_id: "47430", name: "design-marketing" },
  "design-product": { external_id: "38751", name: "design-product" },
  "needs-design": { external_id: "24005", name: "design" }
};

const sendConfirmation = story => {
  const confirmationChannel = "#elevio_feedback";

  console.log("this is the story log", story);
  axios
    .post(
      "https://slack.com/api/chat.postMessage",
      qs.stringify({
        token: process.env.SLACK_ACCESS_TOKEN,
        channel: confirmationChannel,
        attachments: JSON.stringify([
          {
            fallback: story.title,
            title: story.title,
            title_link: story.url,
            text: story.text,
            author_name: `Design Product Story ID #${story.id}`,
            author_link: story.url,
            author_icon:
              "https://files.readme.io/9e0ee9d-small-logo.png" ||
              story.slackImage,
            color: "#08bbdf",
            fields: [
              {
                title: "Priority",
                value: story.urgent,
                short: true
              },
              {
                title: "Effort",
                value: story.category,
                short: true
              },
              {
                title: "Type of Request",
                value: story.request_type,
                short: true
              },
              {
                title: "Supporting documentation Link",
                value: story.link || "none",
                short: true
              },
              {
                title: `Description`,
                value: story.textarea || "None provided",
                short: false
              }
            ],
            // image_url: story.slackImage,
            // thumb_url: story.slackImage,
            footer_icon:
              story.slackImage || "https://clubhouse.io/images/dot-16px.png",
            footer: `Requestor <@${story.slackHandle}>`
          }
        ])
      })
    )
    .then(result => {
      debug("sendConfirmation: %o", result.data);
    })
    .catch(err => {
      debug("sendConfirmation error: %o", err);
      console.error(err);
    });
};

// get Slack username
const fetchUserName = userId => {
  return new Promise((resolve, reject) => {
    users
      .find(userId)
      .then(result => {
        console.log(
          `fetchUserName Find Slack user: ${JSON.stringify(
            result.data,
            null,
            2
          )}`
        );
        resolve({
          name: result.data.user.profile.real_name_normalized,
          email: result.data.user.profile.email,
          image: result.data.user.profile.image_24,
          slackHandle: result.data.user.name
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

const fetchClubhouseUserId = userEmail => {
  return new Promise((resolve, reject) => {
    clubhouse
      .listMembers()
      .then(members => {
        console.log("fetchClubhouseUserId_userEmail: ", userEmail);
        let member = members.filter(m => m.profile.email_address === userEmail);
        console.log("fetchClubhouseUserId_member: ", member[0]);
        // resolve(member && member[0] && member[0].id);
        resolve(member && member[0]);
      })
      .catch(err => {
        reject(err);
      });
  });
};

// Create Clubhouse story
const createStory = (userId, submission) => {
  const story = {};

  console.log("submission: ===> ", submission);

  story.title = submission.title;
  story.projectId = process.env.CLUBHOUSE_BUGS_PROJECT_ID;
  story.story_type = "feature";
  story.category = submission.category;

  // story.labels = [];
  // story.labels.push(labels[submission.category]);

  // used for confirmation
  story.userId = userId;
  story.urgent = submission.urgent;
  story.request_type = submission.request_type;
  story.category = submission.category;
  story.link = submission.documentation_link;

  story.textarea = submission.description;

  fetchUserName(userId)
    .then(result => {
      console.log("fetchUserName result: ", result);
      const userName = result.name;
      const userEmail = result.email;
      const slackImage = result.image;
      const slackHandle = result.slackHandle;
      story.name = userName;
      story.slackImage = slackImage;
      story.slackHandle = slackHandle;
      // set the full description body (now that we have userName)
      story.description = `
			
			\n **Request Type** ${submission.request_type}\n  \n **Urgency** ${
        submission.urgent
      }\n

			\n**Priority** ${submission.category}\n 

			\n**description** \n 
			\n ${submission.description}\n
			 
			 \n Documentation Link \n ${submission.documentation_link ||
         "no documentation link"}\n
			`;

      return fetchClubhouseUserId(userEmail);
    })
    .then(result => {
      console.log("fetch clubhouse user id result: ", result.profile);

      // set the requested by ID
      story.requested_by_id = result.id;
      story.display_icon = result.profile.display_icon.url;
      // send story data to clubhouse
      clubhouse
        .createStory({
          name: story.title,
          project_id: story.projectId,
          requested_by_id: story.requested_by_id,
          description: story.description,
          story_type: story.story_type,
          labels: story.labels
        })
        .then(response => {
          console.log("Clubhouse response: ", response);

          story.id = response.id;
          story.url = response.app_url;
          sendConfirmation(story);
        })
        .catch(function(error) {
          console.log(error);
        });

      return story;
    })
    .catch(err => {
      console.error(err);
    });
};

const find = slackUserId => {
  const body = { token: process.env.SLACK_ACCESS_TOKEN, user: slackUserId };
  const promise = axios.post(
    "https://slack.com/api/users.info",
    qs.stringify(body)
  );
  return promise;
};

module.exports = { createStory, sendConfirmation };

//
//  Send card creation confirmation via
//  chat.postMessage to the user who created it
//
// blocks: JSON.stringify([
// 	{
// 		type: "section",
// 		text: {
// 			type: "plain_text",
// 			text: "A plain text section block.",
// 			emoji: true
// 		}
// 	},
// 	{
// 		type: "context",
// 		elements: [
// 			{
// 				type: "mrkdwn",
// 				text: `*Requestor:* <@${story.userId}>:`
// 			}
// 		]
// 	},

// 	{
// 		type: "section",
// 		text: {
// 			type: "mrkdwn",
// 			text: "You can add a button alongside text in your message🌚. "
// 		},
// 		accessory: {
// 			type: "button",
// 			// trigger_id: story.trigger_id,
// 			text: {
// 				type: "plain_text",
// 				text: "Button Jump",
// 				emoji: true
// 			},
// 			value: "click_me_123"
// 		}
// 	}
// ])

// extra details
//	unfurl_links: true,
// unfurl_media: true,
