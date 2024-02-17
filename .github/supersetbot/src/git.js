import simpleGit from 'simple-git';
import semver from 'semver';

import GitRelease from './git_release.js';

export default class Git {
  #releaseTags;

  constructor(context, mainBranch = 'master') {
    this.context = context;
    this.mainBranch = mainBranch;
    this.releases = new Map();
    this.git = simpleGit();
  }

  async mainBranchGitRelease() {
    if (!this.releases.get(this.mainBranch)) {
      await this.loadRelease(this.mainBranch);
    }
    return this.releases.get(this.mainBranch);
  }

  async releaseTags() {
    if (!this.#releaseTags) {
      const tags = await this.git.tags();
      // Filter tags to include only those that match semver and are official releases
      const semverTags = tags.all.filter((tag) => semver.valid(tag) && !tag.includes('-') && !tag.includes('v'));
      semverTags.sort((a, b) => semver.compare(a, b));
      this.#releaseTags = semverTags;
    }
    return this.#releaseTags;
  }

  async loadMainBranch() {
    await this.loadRelease(this.mainBranch);
  }

  async loadReleases(tags = null) {
    const tagsToFetch = tags || await this.releaseTags();
    if (!tags) {
      await this.loadMainBranch();
    }
    const promises = [];
    tagsToFetch.forEach((tag) => {
      promises.push(this.loadRelease(tag));
    });
    await Promise.all(promises);
  }

  async loadRelease(tag) {
    const release = new GitRelease(tag, this.context);
    await release.load();
    this.releases.set(tag, release);
    return release;
  }

  static shortenSHA(sha) {
    return sha.substring(0, 7);
  }

  async getReleaseLabels(prNumber, verbose, includeCherries = false) {
    const labels = [];
    const main = await this.mainBranchGitRelease();
    const sha = main.prCommitMap.get(prNumber);
    if (sha) {
      const shortSHA = Git.shortenSHA(sha);
      if (verbose) {
        console.log(`PR ${prNumber} is ${shortSHA} on branch ${this.mainBranch}`);
      }

      let firstGitReleased = null;
      this.releases.forEach((release) => {
        if (release.commitPrMap.get(sha) && !firstGitReleased && release.tag !== this.mainBranch) {
          firstGitReleased = release.tag;
          labels.push(`🚢 ${release.tag}`);
        }
        const shaInGitRelease = release.prCommitMap.get(prNumber);
        if (includeCherries && shaInGitRelease && shaInGitRelease !== sha) {
          labels.push(`🍒 ${release.tag}`);
        }
      });
      if (!firstGitReleased) {
        labels.push('🚢 next');
      }
      return labels;
    }
    return [];
  }

  async previousRelease(release) {
    const tags = await this.releaseTags();
    return tags[tags.indexOf(release) - 1];
  }

  async getPRsToSync(release, verbose = false, includeCherries = false) {
    const prevRelease = await this.previousRelease(release);
    const releaseRange = new GitRelease(release, this.context, prevRelease);
    await releaseRange.load();
    const prs = [];
    const promises = [];
    releaseRange.prCommitMap.forEach((value, prNumber) => {
      promises.push(
        this.getReleaseLabels(prNumber, verbose, includeCherries)
          .then((labels) => {
            prs.push({ prNumber, labels });
          }),
      );
    });
    await Promise.all(promises);
    return prs;
  }
}
