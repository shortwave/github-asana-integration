import { getInput, info, error } from '@actions/core';
import { context } from '@actions/github';
import { Client } from 'asana';


const ASANA_TASK_LINK_REGEX = /https:\/\/app\.asana\.com\/(?:\d+\/(?:home\/\d+\/|\d+\/)|\d+\/\d+\/project\/\d+\/task\/)(?<taskId>\d+)/ig;

async function addComment(client: Client, taskId: string, comment: string): Promise<void> {
  await client.tasks.addComment(taskId, {text: comment});
  info(`Added the GitHub link to the Asana task: ${taskId}`);
}

function getPreviousText(): {text?: string} {
  if (context.payload.action === 'edited') {
    const text = context.payload.changes?.body?.from;
    if (text) {
      return {text};
    }
  }

  return {};
}

function getCurrentTextAndUrl(): {url: string, text: string} {
  const pullRequest = context.payload.pull_request;
  const issue = context.payload.issue
  const comment = context.payload.comment;
  if (pullRequest) {
    info(`Extracting information from PR: ${pullRequest.html_url}`);
    return {
      url: pullRequest.html_url,
      text: pullRequest.body,
    }
  } else if (issue && comment) {
    info(`Extracting information from issue: ${issue.html_url}`);
    return {
      url: comment.html_url,
      text: comment.body,
    }
  }

  throw new Error('Must be used on pull_request and issue_comment events only');
}

function extractTasks(text: string): Set<string> {
  ASANA_TASK_LINK_REGEX.lastIndex = 0;
  const tasks = new Set<string>();
  let rawParseUrl: RegExpExecArray | null;
  while ((rawParseUrl = ASANA_TASK_LINK_REGEX.exec(text)) !== null) {
    tasks.add(rawParseUrl.groups.taskId);
  }

  return tasks;
}

function difference(setA: Set<string>, setB: Set<string>): Set<string> {
  let diff = new Set<string>(setA);
  for (let elem of setB) {
    diff.delete(elem);
  }

  return diff;
}

async function main() {
  const personalAccessToken = getInput('asana-pat');
  if (!personalAccessToken) {
    throw new Error('Asana personal access token (asana-pat) not specified');
  }

  const { url, text } = getCurrentTextAndUrl();
  const currentTasks = extractTasks(text);

  const { text: previous } = getPreviousText();
  const previousTasks = (previous && extractTasks(previous)) ?? new Set<string>();

  const tasks = difference(currentTasks, previousTasks);
  const deduped = currentTasks.size - tasks.size;
  if (deduped > 0) {
    info(`Deduplicated ${deduped} tasks`);
  }

  if (tasks.size === 0) {
    info('No new Asana tasks referenced. Done.');
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
