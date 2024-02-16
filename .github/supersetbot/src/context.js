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
import { Octokit } from '@octokit/rest';

class Context {

  #octokit;

  constructor(source) {
    this.hasErrors = false;

    this.source = source;
    this.repo = process.env.GITHUB_REPOSITORY;
    this.options = {};
    this.errorLogs = [];
    this.logs = [];
    this.#octokit = null;
  }

  get github() {
    if (!this.#octokit) {
      if (!process.env.GITHUB_TOKEN) {
        const msg = 'GITHUB_TOKEN is not set. Please set the GITHUB_TOKEN environment variable.';
        this.logError(msg);
      }
      this.#octokit = new Octokit({ auth: `token ${process.env.GITHUB_TOKEN}` });
    }
    return this.#octokit;
  }

  requireOption(optionName, options) {
    const optionValue = options[optionName];
    if (optionValue === undefined || optionValue === null) {
      this.logError(`🔴 ERROR: option [${optionName}] is required`);
      this.hasError = true;
    }
  }

  requireOptions(optionNames, options) {
    optionNames.forEach((optionName) => {
      this.requireOption(optionName, options);
    });
  }

  log(msg) {
    console.log(msg);
    this.logs = [...this.logs, msg];
  }

  processOptions(command, requiredOptions) {
    const raw = command.parent?.rawArgs;
    this.command = '???';
    if (raw) {
      this.command = raw.map((s) => (s.includes(' ') ? `"${s}"` : s)).join(' ').replace('node ', '');
    }
    this.options = { ...command.opts(), ...command.parent.opts() };
    this.requireOptions(requiredOptions, this.options);
    this.issueNumber = this.options.issue;

    if (this.source === 'GHA') {
      this.options.actor = process.env.GITHUB_ACTOR || 'UNKNOWN';
      this.options.repo = process.env.GITHUB_REPOSITORY;
    }

    return this.options;
  }

  logError(msg) {
    this.hasErrors = true;
    console.error(msg);
    this.errorLogs.push(msg);
  }

  commandWrapper({
    func, successMsg, errorMsg = null, verbose = false,
  }) {
    return async (...args) => {
      let resp;
      try {
        resp = await func(...args);
        if (verbose) {
          console.log(resp);
        }
      } catch (error) {
        if (errorMsg) {
          this.logError(`🔴 ERROR: ${errorMsg}`);
        } else {
          this.logError(`🔴 ERROR: ${error}`);
        }
      }
      if (successMsg) {
        this.log(`🟢 SUCCESS: ${successMsg}`);
      }
      return resp;
    };
  }

  doneComment() {
    const msgs = [...this.logs, ...this.errorLogs];
    let comment = '';
    comment += `> \`${this.command}\`\n`;
    comment += '```\n';
    comment += msgs.join('\n');
    comment += '\n```';
    return comment;
  }

  async createComment(body) {
    const [owner, repo] = this.repo.split('/');
    await this.github.rest.issues.createComment({
      owner,
      repo,
      body,
      issue_number: this.issueNumber,
    });
  }

  async onDone() {
    if (this.source === 'GHA') {
      const comment = this.doneComment();
      await this.createComment(comment);
    }
  }
}

export default Context;
