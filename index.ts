import { getInput, info, error } from '@actions/core';
import { context } from '@actions/github';
import { Client } from 'asana';


const ASANA_TASK_LINK_REGEX = /https:\/\/app.asana.com\/(\d+)\/(?<project>\d+)\/(?<taskId>\d+).*?/ig;

async function addComment(client: Client, taskId: string, comment: string): Promise<void> {
  await client.tasks.addComment(taskId, {text: comment});
  info(`Added the GitHub link to the Asana task: ${taskId}`);
}

function getPreviousText(): string | null {
  info(JSON.stringify(context.payload));
  if (context.payload.action === 'edited') {
    return context.payload.changes;
  }

  return null;
}

function extractGitHubEventParameters(): {url: string, text: string, previous: string | null} {
  const pullRequest = context.payload.pull_request;
  const issue = context.payload.issue
  const comment = context.payload.comment;
  const previous = getPreviousText();
  if (pullRequest) {
    info(`Extracting information from PR: ${pullRequest.html_url}`);
    return {
      url: pullRequest.html_url,
      text: pullRequest.body,
      previous,
    }
  } else if (issue && comment) {
    info(`Extracting information from issue: ${issue.html_url}`);
    return {
      url: comment.html_url,
      text: comment.body,
      previous,
    }
  }

  throw new Error('Must be used on pull_request and issue_comment events only');
}

async function main() {
  const personalAccessToken = getInput('asana-pat');
  if (!personalAccessToken) {
    throw new Error('Asana personal access token (asana-pat) not specified');
  }

  const { url, text, previous } = extractGitHubEventParameters();
  info(JSON.stringify(previous));
  const tasks = new Set<string>();
  let rawParseUrl: RegExpExecArray | null;
  while ((rawParseUrl = ASANA_TASK_LINK_REGEX.exec(text)) !== null) {
    tasks.add(rawParseUrl.groups.taskId);
  }

  if (tasks.size === 0) {
    info('No Asana tasks referenced. Done.');
    return;
  }

  const options = {
    defaultHeaders: { 'asana-enable': 'string_ids' },
    logAsanaChangeWarnings: false,
  };
  const client = Client.create(options).useAccessToken(personalAccessToken);
  const commentPrefix = getInput('comment-prefix') || `${context.payload.sender.login} referenced in: `;
  const comment = `${commentPrefix}${url}`;
  for (const taskId of tasks) {
    await addComment(client, taskId, comment);
  }
}

(async () => {
  try {
    await main();
  } catch (err) {
    error(err);
  }
})();
