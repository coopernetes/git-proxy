import { Request } from 'express';
import { GithubAction, GithubPullAction, GithubPushAction } from './action';

/**
 * Checks if the request is a push request.
 * @param {Request} request - The request object.
 * @return {boolean} - True if it is a push request, false otherwise.
 */
function isPushRequest(request: Request): boolean {
  const url = new URL(request.url);
  const lastPathPart = url.pathname.split('/').pop();
  return (
    lastPathPart === 'git-receive-pack' &&
    request.method === 'POST' &&
    request.headers['content-type'] === 'application/x-git-receive-pack-request'
  );
}

/**
 * Parses the request and returns the corresponding GitHub action.
 * @param {Request} request - The request object.
 * @return {GithubAction} - The GitHub action.
 */
export function parseGithubRequest(request: Request): GithubAction {
  const url = new URL(request.url);
  if (isPushRequest(request)) {
    return new GithubPushAction(url);
  }
  return new GithubPullAction(url);
}
