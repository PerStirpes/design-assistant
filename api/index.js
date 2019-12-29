require("dotenv").config();

const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const qs = require("querystring");
const serverless = require("serverless-http");
// const clubhouse = require("./clubhouse");
const debug = require("debug")("slash-command-template:index");
const Clubhouse1 = require("clubhouse-lib");

// Production

const clubhouse = Clubhouse1.create("5d6c4680-2284-4a2d-b5d1-e4d10feea063"); // ASU ACCOUNT API TOKEN

const app = express();
const router = express.Router();

const effortOptions = [
  { label: "Tiny (Few Hours)", value: "Tiny" },
  { label: "Small (1-3 Days)", value: "Small" },
  { label: "Medium (1 Week),", value: "Medium" },
  { label: "Large (2 Weeks),", value: "Large" }
];
const typeOptions = [
  { label: "Research", value: "Research" },
  { label: "Visual", value: "Visual" },
  { label: "Patterns", value: "Patterns" },
  { label: "Feature", value: "Feature" }
];

const labels = {
  design: { external_id: "53", name: "design" },
  "design-debt": { external_id: "19169", name: "design-deb" },
  "design-assist": { external_id: "47430", name: "design-marketing" },
  "design-product": { external_id: "38751", name: "design-product" },
  "needs-design": { external_id: "24005", name: "design" }
};

const priorityOptions = [
  { label: "Low", value: "Low" },
  { label: "Medium", value: "Medium" },
  { label: "High", value: "High" }
];
/*
 * Parse application/x-www-form-urlencoded && application/json
 */

router.get("/", (req, res) => {
  res.send(
    "<h2>The Slash Command and Dialog app is running</h2> <p>Follow the" +
      " instructions in the README to configure the Slack App and your environment variables.</p>"
  );
});

/*
 * Endpoint to receive /helpdesk slash command from Slack.
 * Checks verification token and opens a dialog to capture more info.
 */
router.post("/api/command", (req, res) => {
  // extract the verification token, slash command text,
  // and trigger ID from payload
  const { token, text, trigger_id } = req.body;

  // check that the verification token matches expected value
  if (token === process.env.SLACK_VERIFICATION_TOKEN) {
    // create the dialog payload - includes the dialog structure, Slack API token,
    // and trigger ID
    const dialog = {
      token: process.env.SLACK_ACCESS_TOKEN,
      trigger_id,
      dialog: JSON.stringify({
        title: "Design Request 🎨",
        callback_id: "submit-card",
        submit_label: "Submit",
        elements: [
          {
            label: "Assist description",
            type: "text",
            name: "title",
            value: text,
            hint: "Instructions here: ld.click/design-assistant"
          },
          {
            label: "Type of Request",
            type: "select",
            name: "request_type",
            options: typeOptions
          },
          {
            label: "Effort Involved",
            type: "select",
            name: "category",
            placeholder: "Vigorousity",
            options: effortOptions
          },
          {
            label: "How urgent is your request?",
            type: "select",
            name: "urgent",
            placeholder: "Priority",
            options: priorityOptions
          },
          {
            label: "Supporting documentation link",
            type: "text",
            name: "documentation_link",
            optional: true,
            subtype: "url",
            placeholder: `http://lostudio.net`
          },

          {
            label: "Description",
            type: "textarea",
            name: "description",
            optional: true,
            placeholder: `Add a short description for additional context`
          }
        ]
      })
    };

    // open the dialog by calling dialogs.open method and sending the payload
    axios
      .post("https://slack.com/api/dialog.open", qs.stringify(dialog))
      .then(result => {
        debug("dialog.open: %o", result.data);
        res.send("");
      })
      .catch(err => {
        debug("dialog.open call failed: %o", err);
        res.sendStatus(500);
      });
  } else {
    debug("Verification token mismatch");
    res.sendStatus(500);
  }
});

/*
 * Endpoint to receive the dialog submission.
 */
router.post("/api/interactive", (req, res) => {
  const body = JSON.parse(req.body.payload);

  // check that the verification token matches expected value
  if (body.token === process.env.SLACK_VERIFICATION_TOKEN) {
    // immediately respond with a empty 200 response to let
    // Slack know the command was received
    res.send("");

    if (body.type === "message_action") {
      // this was a message action, we still need to open the dialog

      const trigger_id = body.trigger_id;
      const text = body.message.text;

      const dialog = {
        token: process.env.SLACK_ACCESS_TOKEN,
        trigger_id,
        dialog: JSON.stringify({
          title: "Design Request",
          callback_id: "submit-card",
          submit_label: "Submit",
          elements: [
            {
              label: "Title",
              type: "text",
              name: "title",
              value: text,
              hint: "this is a hint"
            },
            {
              label: "Labels",
              type: "select",
              name: "category",
              options: labels
            },
            {
              label: "Description",
              type: "textarea",
              name: "description",
              optional: true,
              placeholder: `Write a short description of what you need`
            }
          ]
        })
      };

      // open the dialog by calling dialogs.open method and sending the payload
      axios
        .post("https://slack.com/api/dialog.open", qs.stringify(dialog))
        .then(result => {
          debug("dialog.open: %o", result.data);
          res.send("");
        })
        .catch(err => {
          debug("dialog.open call failed: %o", err);
          res.sendStatus(500);
        });
    } else {
      // this is a dialog submission, just create the Trello card.
      let dialogSubmission = body.submission;
      debug(`Form submission received: ${dialogSubmission.trigger_id}`);
      //trello.createCard(body.user.id, body.submission);
      createStory(body.user.id, dialogSubmission);
      module.exports = { dialogSubmission };
    }
  } else {
    debug("Token mismatch");
    res.sendStatus(500);
  }
});

//////////////////////////////////////////////////////////

//
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
    find(userId)
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

app.use("/.netlify/functions/index", router); // path must route to lambda
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.listen(process.env.PORT, () => {
  console.log(`App listening on port ${process.env.PORT}!`);
});

module.exports = app;
module.exports.handler = serverless(app);
