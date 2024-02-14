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
import * as commands from './commands.js';

export default function getCLI(envContext) {
  const program = new Command();
  // Setting up top-level CLI options
  program
    .option('-v, --verbose', 'Output extra debugging information')
    .option('-r, --repo <repo>', 'The GitHub repo to use (ie: "apache/superset")', process.env.GITHUB_REPOSITORY)
    .option('-a, --actor <actor>', 'The actor', process.env.GITHUB_ACTOR);

  const issueOptionParams = ['-i, --issue <issue>', 'The issue number', process.env.GITHUB_ISSUE_NUMBER];

  program.command('label <label>')
    .description('Add a label to an issue or PR')
    .option(...issueOptionParams)
    .action(async function (label) {
      const opts = envContext.processOptions(this, ['issue', 'repo']);
      await commands.label(opts.repo, opts.issue, label, envContext, opts.actor, opts.verbose);
    });

  program.command('unlabel <label>')
    .description('Remove a label from an issue or PR')
    .option(...issueOptionParams)
    .action(async function (label) {
      const opts = envContext.processOptions(this, ['issue', 'repo']);
      await commands.unlabel(opts.repo, opts.issue, label, envContext, opts.actor, opts.verbose);
    });

  program.command('orglabel')
    .description('Add an org label based on the author')
    .option(...issueOptionParams)
    .action(async function () {
      const opts = envContext.processOptions(this, ['issue', 'repo']);
      const wrapped = envContext.commandWrapper({
        func: commands.assignOrgLabel,
        successMsg: 'added the right labels',
        errorMsg: 'FAILED at stuff',
        verbose: opts.verbose,
      });
      await wrapped(opts.repo, opts.issue, envContext);
    });

  return program;
}
