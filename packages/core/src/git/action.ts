import { v4 as uuidv4 } from 'uuid';

export interface Action {
  id: string; // uuid
  timestamp: number; // unix timestamp
  url: URL; // git repository url
}

export interface GithubRepository extends Action {
  repoOwner: string;
  repoName: string;
}

/**
 * Represents a push action in Git.
 */
export class PushAction implements Action {
  /**
   * The unique identifier of the push action.
   */
  id: string;
  /**
   * The timestamp of when the push action occurred.
   */
  timestamp: number;
  /**
   * The URL of the Git repository.
   */
  url: URL;
  /**
   * Creates a new PushAction instance.
   * @param {URL} url The URL of the Git repository.
   */
  constructor(url: URL) {
    this.id = uuidv4();
    this.timestamp = Date.now();
    this.url = url;
  }
}

/**
 * Represents a pull action in Git.
 */
export class PullAction implements Action {
  /**
   * The unique identifier of the pull action.
   */
  id: string;
  /**
   * The timestamp of when the pull action occurred.
   */
  timestamp: number;
  /**
   * The URL of the Git repository.
   */
  url: URL;

  /**
   * Creates a new PullAction instance.
   * @param {URL} url The URL of the Git repository.
   */
  constructor(url: URL) {
    this.id = uuidv4();
    this.timestamp = Date.now();
    this.url = url;
  }
}

/**
 * Gets the repository owner from the URL.
 * @param {URL} url The URL of the Git repository.
 * @return {string} The repository owner.
 */
/**
 * Gets the repository owner from the URL.
 * @param {URL} url The URL of the Git repository.
 * @return {string} The repository owner.
 */
function getRepoOwnerFromUrl(url: URL): string {
  return url.pathname.split('/')[1];
}

/**
 * Gets the repository name from the URL.
 * @param {URL} url The URL of the Git repository.
 * @return {string} The repository name.
 */
function getRepoNameFromUrl(url: URL): string {
  return url.pathname.split('/')[2].replace('.git', '');
}

/**
 * Represents a push action in Git for GitHub repositories.
 */
export class GithubPushAction implements GithubRepository {
  /**
   * The unique identifier of the push action.
   */
  readonly id: string;
  /**
   * The timestamp of when the push action occurred.
   */
  readonly timestamp: number;
  /**
   * The URL of the Git repository.
   */
  readonly url: URL;
  /**
   * The owner of the GitHub repository.
   */
  readonly repoOwner: string;
  /**
   * The name of the GitHub repository.
   */
  readonly repoName: string;

  /**
   * Creates a new GithubPushAction instance.
   * @param {URL} url The URL of the Git repository.
   */
  constructor(url: URL) {
    this.id = uuidv4();
    this.timestamp = Date.now();
    this.url = url;
    this.repoOwner = getRepoOwnerFromUrl(url);
    this.repoName = getRepoNameFromUrl(url);
  }
}

/**
 * Represents a pull action in Git for GitHub repositories.
 */
export class GithubPullAction implements GithubRepository {
  /**
   * The unique identifier of the pull action.
   */
  readonly id: string;
  /**
   * The timestamp of when the pull action occurred.
   */
  readonly timestamp: number;
  /**
   * The URL of the Git repository.
   */
  readonly url: URL;
  /**
   * The owner of the GitHub repository.
   */
  readonly repoOwner: string;
  /**
   * The name of the GitHub repository.
   */
  readonly repoName: string;

  /**
   * Creates a new GithubPullAction instance.
   * @param {URL} url The URL of the Git repository.
   */
  constructor(url: URL) {
    this.id = uuidv4();
    this.timestamp = Date.now();
    this.url = url;
    this.repoOwner = getRepoOwnerFromUrl(url);
    this.repoName = getRepoNameFromUrl(url);
  }
}

export type GitAction = PushAction | PullAction;
export type GithubAction = GithubPushAction | GithubPullAction;
