import { Octokit } from '@octokit/rest';
import { ORG_LIST, PROTECTED_LABEL_PATTERNS, COMMITTER_TEAM } from './metadata.js';

class Github {
  constructor(context, issueNumber = null, token = null) {
    this.context = context;
    this.issueNumber = issueNumber;
    const githubToken = token || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      const msg = 'GITHUB_TOKEN is not set. Please set the GITHUB_TOKEN environment variable.';
      this.context.logError(msg);
    }
    this.octokit = new Octokit({ auth: githubToken });
  }

  unPackRepo() {
    const [owner, repo] = this.context.repo.split('/');
    return { repo, owner };
  }

  async label(issueNumber, label, actor = null, verbose = false, dryRun = false) {
    let hasPerm = true;
    if (actor && Github.isLabelProtected(label)) {
      hasPerm = await this.checkIfUserInTeam(actor, COMMITTER_TEAM, verbose);
    }
    if (hasPerm) {
      const addLabelWrapped = this.context.commandWrapper({
        func: this.octokit.rest.issues.addLabels,
        successMsg: `label "${label}" added to issue ${issueNumber}`,
        verbose,
        dryRun,
      });
      await addLabelWrapped({
        ...this.unPackRepo(),
        issue_number: issueNumber,
        labels: [label],
      });
    }
  }

  async createComment(body) {
    if (this.issueNumber) {
      await this.oktokit.rest.issues.createComment({
        ...this.unPackRepo(),
        body,
        issue_number: this.issueNumber,
      });
    }
  }

  async unlabel(issueNumber, label, actor = null, verbose = false, dryRun = false) {
    let hasPerm = true;
    if (actor && Github.isLabelProtected(label)) {
      hasPerm = await this.checkIfUserInTeam(actor, COMMITTER_TEAM, verbose);
    }
    if (hasPerm) {
      const removeLabelWrapped = this.context.commandWrapper({
        func: this.octokit.rest.issues.removeLabel,
        successMsg: `label "${label}" removed from issue ${issueNumber}`,
        verbose,
        dryRun,
      });
      await removeLabelWrapped({
        ...this.unPackRepo(),
        issue_number: issueNumber,
        name: label,
      });
    }
  }

  async assignOrgLabel(issueNumber, verbose = false, dryRun = false) {
    const issue = await this.octokit.rest.issues.get({
      ...this.unPackRepo(),
      issue_number: issueNumber,
    });
    const username = issue.data.user.login;
    const orgs = await this.octokit.orgs.listForUser({ username });
    const orgNames = orgs.data.map((v) => v.login);

    // get list of matching github orgs
    const matchingOrgs = orgNames.filter((org) => ORG_LIST.includes(org));
    if (matchingOrgs.length) {
      const wrapped = this.context.commandWrapper({
        func: this.octokit.rest.issues.addLabels,
        successMsg: `added label(s) ${matchingOrgs} to issue ${issueNumber}`,
        errorMsg: "couldn't add labels to issue",
        verbose,
        dryRun,
      });
      wrapped({
        ...this.unPackRepo(),
        issue_number: issueNumber,
        labels: matchingOrgs,
      });
    }
  }

  async syncLabels(labels, prId, actor = null, verbose = false, dryRun = false) {
    let hasPerm = true;
    if (actor) {
      hasPerm = await this.checkIfUserInTeam(actor, COMMITTER_TEAM, verbose);
    }
    if (!hasPerm) {
      return;
    }
    const { data: existingLabels } = await this.octokit.issues.listLabelsOnIssue({
      ...this.unPackRepo(),
      issue_number: prId,
    });

    if (verbose) {
      this.context.log(`All release labels: ${labels}`);
      this.context.log(`Existing labels on issue: ${existingLabels.map((l) => l.name)}`);
    }

    // Extract existing labels with the given prefix
    const existingPrefixLabels = existingLabels
      .filter((label) => label.name.startsWith('🚢') || label.name.startsWith('🍒'))
      .map((label) => label.name);

    // Labels to add
    const labelsToAdd = labels.filter((label) => !existingPrefixLabels.includes(label));
    if (verbose) {
      this.context.log(`Labels to add: ${labelsToAdd}`);
    }

    // Labels to remove
    const labelsToRemove = existingPrefixLabels.filter((label) => !labels.includes(label));
    if (verbose) {
      this.context.log(`Labels to remove: ${labelsToRemove}`);
    }

    // Add labels
    if (labelsToAdd.length > 0 && !dryRun) {
      await this.octokit.issues.addLabels({
        ...this.unPackRepo(),
        issue_number: prId,
        labels: labelsToAdd,
      });
    }

    // Remove labels
    if (labelsToRemove.length > 0 && !dryRun) {
      await Promise.all(labelsToRemove.map((label) => this.octokit.issues.removeLabel({
        ...this.unPackRepo(),
        issue_number: prId,
        name: label,
      })));
    }
    this.context.logSuccess(`synched labels for PR ${prId} with labels ${labels}`);
  }

  async checkIfUserInTeam(username, team, verbose = false) {
    const [org, teamSlug] = team.split('/');
    const wrapped = this.context.commandWrapper({
      func: this.octokit.teams.getMembershipForUserInOrg,
      errorMsg: `User "${username}" is not authorized to alter protected labels.`,
      verbose,
    });
    const resp = await wrapped({
      org,
      team_slug: teamSlug,
      username,
    });
    return resp?.data?.state === 'active';
  }

  static isLabelProtected(label) {
    return PROTECTED_LABEL_PATTERNS.some((pattern) => new RegExp(pattern).test(label));
  }
}

export default Github;
