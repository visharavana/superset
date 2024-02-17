/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { Command } from 'commander';

import * as docker from './docker.js';
import * as utils from './utils.js';
import Github from './github.js';
import Git from './git.js';

export default function getCLI(context) {
  const program = new Command();
  const issueOptionParams = ['-i, --issue <issue>', 'The issue number', process.env.GITHUB_ISSUE_NUMBER];

  // Setting up top-level CLI options
  program
    .option('-v, --verbose', 'Output extra debugging information')
    .option('-r, --repo <repo>', 'The GitHub repo to use (ie: "apache/superset")', process.env.GITHUB_REPOSITORY)
    .option('-d, --dry-run', 'Run the command in dry-run mode')
    .option('-a, --actor <actor>', 'The actor', process.env.GITHUB_ACTOR);

  program.command('label <label>')
    .description('Add a label to an issue or PR')
    .option(...issueOptionParams)
    .action(async function (label) {
      const opts = context.processOptions(this, ['issue', 'repo']);
      const github = new Github(context, opts.repo, opts.issue);
      await github.label(opts.issue, label, context, opts.actor, opts.verbose, opts.dryRun);
    });

  program.command('unlabel <label>')
    .description('Remove a label from an issue or PR')
    .option(...issueOptionParams)
    .action(async function (label) {
      const opts = context.processOptions(this, ['issue', 'repo']);
      const github = new Github(context, opts.repo, opts.issue);
      await github.unlabel(opts.issue, label, context, opts.actor, opts.verbose, opts.dryRun);
    });

  program.command('release-label <prId>')
    .description('Figure out first release for PR and label it')
    .action(async function (prId) {
      const opts = context.processOptions(this, ['repo']);
      const git = new Git(context);
      await git.loadReleases();

      const labels = await git.getReleaseLabels(parseInt(prId, 10));
      const github = new Github(context, opts.repo, prId);
      await github.syncLabels(labels, prId, opts.actor, opts.verbose, opts.dryRun);
    });

  program.command('on-release <release>')
    .description('Figure out first release for PR and label it')
    .option('-c, --include-cherries', 'Generate cherry labels point to each release where the PR has been cherried')
    .action(async function (release) {
      const opts = context.processOptions(this, ['repo']);
      const git = new Git(context);
      await git.loadReleases();
      const prs = await git.getPRsToSync(release, opts.verbose, opts.includeCherries);

      const github = new Github(context, opts.repo);
      const promises = [];
      prs.forEach(({ prNumber, labels }) => {
        promises.push(github.syncLabels(labels, prNumber, opts.actor, opts.verbose, opts.dryRun));
      });
      await Promise.all(promises);
    });

  program.command('orglabel')
    .description('Add an org label based on the author')
    .option(...issueOptionParams)
    .action(async function () {
      const opts = context.processOptions(this, ['issue', 'repo']);
      const github = new Github(context, opts.repo, opts.issue);

      await github.assignOrgLabel(opts.issue, opts.verbose, opts.dryRun);
    });

  program.command('docker')
    .option('-t, --preset', 'Build preset', /^(lean|dev|dockerize|websocket|py310|ci)$/i, 'lean')
    .option('-c, --context <context>', 'Build context', /^(push|pull_request|release)$/i, 'local')
    .option('-r, --context-ref <ref>', 'Reference to the PR, release, or branch')
    .option('-p, --platform <platform...>', 'Platforms (multiple values allowed)')
    .option('-f, --force-latest', 'Force the "latest" tag on the release')
    .option('-v, --verbose', 'Print more info')
    .action(function (preset) {
      const opts = context.processOptions(this, ['repo']);
      opts.platform = opts.platform || ['linux/arm64'];
      const cmd = docker.getDockerCommand({ preset, ...opts });
      context.log(cmd);
      if (!opts.dryRun) {
        utils.runShellCommand(cmd, false);
      }
    });
  program.command('version')
    .action(async () => {
      const version = await utils.currentPackageVersion();
      context.log(version);
    });

  return program;
}
