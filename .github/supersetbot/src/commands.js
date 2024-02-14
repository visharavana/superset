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
import { ORG_LIST, PROTECTED_LABEL_PATTERNS, COMMITTER_TEAM } from './metadata.js';
/* eslint-disable no-shadow */

function unPackRepo(longRepo) {
  const [owner, repo] = longRepo.split('/');
  return { repo, owner };
}

function isLabelProtected(label) {
  return PROTECTED_LABEL_PATTERNS.some((pattern) => new RegExp(pattern).test(label));
}

async function checkIfUserInTeam(username, team, context, verbose) {
  const [org, teamSlug] = team.split('/');
  const wrapped = context.commandWrapper({
    func: context.github.teams.getMembershipForUserInOrg,
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

// -------------------------------------
// Individual commands
// -------------------------------------
export async function label(longRepo, issueNumber, label, context, actor = null, verbose = false) {
  let hasPerm = true;
  if (actor && isLabelProtected(label)) {
    hasPerm = await checkIfUserInTeam(actor, COMMITTER_TEAM, context, verbose);
  }
  if (hasPerm) {
    const addLabelWrapped = context.commandWrapper({
      func: context.github.rest.issues.addLabels,
      successMsg: `label "${label}" added to issue ${issueNumber}`,
      verbose,
    });
    await addLabelWrapped({
      ...unPackRepo(longRepo),
      issue_number: issueNumber,
      labels: [label],
    });
  }
}

export async function unlabel(repo, issueNumber, label, context, actor = null, verbose = false) {
  let hasPerm = true;
  if (actor && isLabelProtected(label)) {
    hasPerm = await checkIfUserInTeam(actor, COMMITTER_TEAM, context, verbose);
  }
  if (hasPerm) {
    const addLabelWrapped = context.commandWrapper({
      func: context.github.rest.issues.removeLabel,
      successMsg: `label "${label}" removed from issue ${issueNumber}`,
      verbose,
    });
    await addLabelWrapped({
      ...unPackRepo(repo),
      issue_number: issueNumber,
      name: label,
    });
  }
}

export async function assignOrgLabel(repo, issueNumber, context) {
  const issue = await context.github.rest.issues.get({
    ...unPackRepo(repo),
    issue_number: issueNumber,
  });
  const username = issue.data.user.login;
  const orgs = await context.github.orgs.listForUser({ username });
  const orgNames = orgs.data.map((v) => v.login);

  // get list of matching github orgs
  const matchingOrgs = orgNames.filter((org) => ORG_LIST.includes(org));
  if (matchingOrgs.length) {
    context.github.rest.issues.addLabels({
      ...unPackRepo(repo),
      issue_number: issueNumber,
      labels: matchingOrgs,
    });
  }
}
