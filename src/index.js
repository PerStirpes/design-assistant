require("dotenv").config();

const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const qs = require("querystring");

const clubhouse = require("./clubhouse");
const debug = require("debug")("slash-command-template:index");

const app = express();
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
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
	res.send(
		"<h2>The Slash Command and Dialog app is running</h2> <p>Follow the" +
			" instructions in the README to configure the Slack App and your environment variables.</p>"
	);
});

/*
 * Endpoint to receive /helpdesk slash command from Slack.
 * Checks verification token and opens a dialog to capture more info.
 */
app.post("/command", (req, res) => {
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
app.post("/interactive", (req, res) => {
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
			clubhouse.createStory(body.user.id, dialogSubmission);
			module.exports = { dialogSubmission };
		}
	} else {
		debug("Token mismatch");
		res.sendStatus(500);
	}
});

app.listen(process.env.PORT, () => {
	console.log(`App listening on port ${process.env.PORT}!`);
});
