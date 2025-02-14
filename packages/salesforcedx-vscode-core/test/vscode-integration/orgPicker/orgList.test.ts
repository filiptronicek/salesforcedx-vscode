/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Aliases, AuthInfo } from '@salesforce/core';
import { expect } from 'chai';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages';
import { FileInfo, OrgList } from '../../../src/orgPicker';
import { OrgAuthInfo } from '../../../src/util';

describe('getAuthInfoObjects', () => {
  it('should return a list of FileInfo objects when given an array of file names', async () => {
    const authFilesArray = [
      'test-username1@example.com',
      'test-username2@example.com'
    ];
    const orgList = new OrgList();
    const listAuthFilesStub = getAuthInfoListAuthFilesStub(authFilesArray);
    const readFileStub = sinon
      .stub(fs, 'readFileSync')
      .onFirstCall()
      .returns(
        JSON.stringify({
          orgId: '000',
          accessToken: '000',
          refreshToken: '000',
          instanceUrl: '000',
          loginUrl: '000',
          username: 'test-username1@example.com'
        })
      );
    readFileStub.onSecondCall().returns(
      JSON.stringify({
        orgId: '111',
        accessToken: '111',
        refreshToken: '111',
        instanceUrl: '111',
        loginUrl: '111',
        username: 'test-username2@example.com'
      })
    );
    const authInfoObjects = await orgList.getAuthInfoObjects();
    if (!isNullOrUndefined(authInfoObjects)) {
      expect(authInfoObjects[0].username).to.equal(
        'test-username1@example.com'
      );
      expect(authInfoObjects[1].username).to.equal(
        'test-username2@example.com'
      );
    }
    listAuthFilesStub.restore();
    readFileStub.restore();
  });

  it('should return null when no auth files are present', async () => {
    const orgList = new OrgList();
    const listAuthFilesStub = getAuthInfoListAuthFilesStub(null);
    const authInfoObjects = await orgList.getAuthInfoObjects();
    expect(authInfoObjects).to.equal(null);
    listAuthFilesStub.restore();
  });

  const getAuthInfoListAuthFilesStub = (returnValue: any) =>
    sinon
      .stub(AuthInfo, 'listAllAuthFiles')
      .returns(Promise.resolve(returnValue));
});

describe('Filter Authorization Info', async () => {
  let defaultDevHubStub: sinon.SinonStub;
  let getUsernameStub: sinon.SinonStub;
  let aliasCreateStub: sinon.SinonStub;
  let aliasKeysStub: sinon.SinonStub;
  const orgList = new OrgList();

  beforeEach(() => {
    defaultDevHubStub = sinon.stub(
      OrgAuthInfo,
      'getDefaultDevHubUsernameOrAlias'
    );
    getUsernameStub = sinon.stub(OrgAuthInfo, 'getUsername');
    aliasCreateStub = sinon.stub(Aliases, 'create');
    aliasKeysStub = sinon.stub(Aliases.prototype, 'getKeysByValue');
  });

  afterEach(() => {
    defaultDevHubStub.restore();
    getUsernameStub.restore();
    aliasCreateStub.restore();
    aliasKeysStub.restore();
  });

  it('should filter the list for users other than admins when scratchadminusername field is present', async () => {
    const authInfoObjects: FileInfo[] = [
      JSON.parse(
        JSON.stringify({
          orgId: '000',
          accessToken: '000',
          refreshToken: '000',
          scratchAdminUsername: 'nonadmin@user.com',
          username: 'test-username1@example.com'
        })
      ),
      JSON.parse(
        JSON.stringify({
          orgId: '111',
          accessToken: '111',
          refreshToken: '111',
          username: 'test-username2@example.com'
        })
      )
    ];
    defaultDevHubStub.returns(null);
    aliasCreateStub.returns(Aliases.prototype);
    aliasKeysStub.returns([]);
    const authList = await orgList.filterAuthInfo(authInfoObjects);
    expect(authList[0]).to.equal('test-username2@example.com');
  });

  it('should filter the list to only show scratch orgs associated with current default dev hub without an alias', async () => {
    const authInfoObjects: FileInfo[] = [
      JSON.parse(
        JSON.stringify({
          orgId: '000',
          username: 'test-scratchorg1@example.com',
          devHubUsername: 'test-devhub1@example.com'
        })
      ),
      JSON.parse(
        JSON.stringify({
          orgId: '111',
          username: 'test-scratchorg2@example.com',
          devHubUsername: 'test-devhub2@example.com'
        })
      )
    ];
    defaultDevHubStub.returns('test-devhub1@example.com');
    getUsernameStub.returns('test-devhub1@example.com');
    aliasCreateStub.returns(Aliases.prototype);
    aliasKeysStub.returns([]);
    const authList = await orgList.filterAuthInfo(authInfoObjects);
    expect(authList[0]).to.equal('test-scratchorg1@example.com');
  });

  it('should filter the list to only show scratch orgs associated with current default dev hub with an alias', async () => {
    const authInfoObjects: FileInfo[] = [
      JSON.parse(
        JSON.stringify({
          orgId: '000',
          username: 'test-scratchorg1@example.com',
          devHubUsername: 'test-devhub1@example.com'
        })
      ),
      JSON.parse(
        JSON.stringify({
          orgId: '111',
          username: 'test-scratchorg2@example.com',
          devHubUsername: 'test-devhub2@example.com'
        })
      )
    ];
    defaultDevHubStub.returns('dev hub alias');
    getUsernameStub.returns('test-devhub1@example.com');
    aliasCreateStub.returns(Aliases.prototype);
    aliasKeysStub.returns([]);
    const authList = await orgList.filterAuthInfo(authInfoObjects);
    expect(authList[0]).to.equal('test-scratchorg1@example.com');
  });

  it('should display alias with username when alias is available', async () => {
    const authInfoObjects: FileInfo[] = [
      JSON.parse(
        JSON.stringify({
          orgId: '000',
          accessToken: '000',
          refreshToken: '000',
          username: 'test-username1@example.com'
        })
      ),
      JSON.parse(
        JSON.stringify({
          orgId: '111',
          accessToken: '111',
          refreshToken: '111',
          username: 'test-username2@example.com'
        })
      )
    ];
    defaultDevHubStub.returns(null);
    aliasCreateStub.returns(Aliases.prototype);
    aliasKeysStub.onFirstCall().returns(['alias1']);
    aliasKeysStub.returns([]);
    const authList = await orgList.filterAuthInfo(authInfoObjects);
    expect(authList[0]).to.equal('alias1 - test-username1@example.com');
  });

  it('should flag the org as expired if expiration date has passed', async () => {
    const oneDayMillis = 60 * 60 * 24 * 1000;
    const today = new Date();
    const yesterday = new Date(today.getTime() - oneDayMillis);
    const tomorrow = new Date(today.getTime() + oneDayMillis);

    const authInfoObjects: FileInfo[] = [
      JSON.parse(
        JSON.stringify({
          orgId: '000',
          username: 'test-scratchorg-today@example.com',
          devHubUsername: 'test-devhub1@example.com',
          expirationDate: today.toISOString().split('T')[0]
        })
      ),
      JSON.parse(
        JSON.stringify({
          orgId: '111',
          username: 'test-scratchorg-yesterday@example.com',
          devHubUsername: 'test-devhub1@example.com',
          expirationDate: yesterday.toISOString().split('T')[0]
        })
      ),
      JSON.parse(
        JSON.stringify({
          orgId: '222',
          username: 'test-scratchorg-tomorrow@example.com',
          devHubUsername: 'test-devhub1@example.com',
          expirationDate: tomorrow.toISOString().split('T')[0]
        })
      )
    ];
    defaultDevHubStub.returns('test-devhub1@example.com');
    getUsernameStub.returns('test-devhub1@example.com');
    aliasCreateStub.returns(Aliases.prototype);
    aliasKeysStub.returns([]);
    const authList = await orgList.filterAuthInfo(authInfoObjects);
    expect(authList[0]).to.equal(
      'test-scratchorg-today@example.com - ' +
        nls.localize('org_expired') +
        ' ' +
        String.fromCodePoint(0x274c)
    );
    expect(authList[1]).to.equal(
      'test-scratchorg-yesterday@example.com - ' +
        nls.localize('org_expired') +
        ' ' +
        String.fromCodePoint(0x274c)
    );
    expect(authList[2]).to.equal('test-scratchorg-tomorrow@example.com');
  });
});

describe('Set Default Org', () => {
  let orgListStub: sinon.SinonStub;
  let quickPickStub: sinon.SinonStub;
  let executeCommandStub: sinon.SinonStub;
  const orgsList = [
    'alias - test-username1@example.com',
    'test-username2@example.com'
  ];
  const orgList = new OrgList();

  beforeEach(() => {
    orgListStub = sinon.stub(OrgList.prototype, 'updateOrgList');
    quickPickStub = sinon.stub(vscode.window, 'showQuickPick');
    executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
  });

  afterEach(() => {
    orgListStub.restore();
    quickPickStub.restore();
    executeCommandStub.restore();
  });

  it('should return Cancel if selection is undefined', async () => {
    orgListStub.returns(orgsList);
    quickPickStub.returns(undefined);
    const response = await orgList.setDefaultOrg();
    expect(response.type).to.equal('CANCEL');
  });

  it('should return Continue and call force:auth:web:login command if SFDX: Authorize an Org is selected', async () => {
    orgListStub.returns(orgsList);
    quickPickStub.returns(
      '$(plus) ' + nls.localize('force_auth_web_login_authorize_org_text')
    );
    const response = await orgList.setDefaultOrg();
    expect(response.type).to.equal('CONTINUE');
    const commandResult = expect(
      executeCommandStub.calledWith('sfdx.force.auth.web.login')
    ).to.be.true;
  });

  it('should return Continue and call force:org:create command if SFDX: Create a Default Scratch Org is selected', async () => {
    orgListStub.returns(orgsList);
    quickPickStub.returns(
      '$(plus) ' + nls.localize('force_org_create_default_scratch_org_text')
    );
    const response = await orgList.setDefaultOrg();
    expect(response.type).to.equal('CONTINUE');
    const commandResult = expect(
      executeCommandStub.calledWith('sfdx.force.org.create')
    ).to.be.true;
  });

  it('should return Continue and call force:auth:dev:hub command if SFDX: Authorize a Dev Hub is selected', async () => {
    orgListStub.returns(orgsList);
    quickPickStub.returns(
      '$(plus) ' + nls.localize('force_auth_web_login_authorize_dev_hub_text')
    );
    const response = await orgList.setDefaultOrg();
    expect(response.type).to.equal('CONTINUE');
    const commandResult = expect(
      executeCommandStub.calledWith('sfdx.force.auth.dev.hub')
    ).to.be.true;
  });

  it('should return Continue and call sfdx:force:auth:accessToken command if SFDX: Authorize an Org using Session ID', async () => {
    orgListStub.returns(orgsList);
    quickPickStub.returns(
      '$(plus) ' + nls.localize('force_auth_access_token_authorize_org_text')
    );
    const response = await orgList.setDefaultOrg();
    expect(response.type).to.equal('CONTINUE');
    const commandResult = expect(
      executeCommandStub.calledWith('sfdx.force.auth.accessToken')
    ).to.be.true;
  });

  it('should return Continue and call force:org:list:clean command if SFDX: Remove Deleted and Expired Orgs is selected', async () => {
    orgListStub.returns(orgsList);
    quickPickStub.returns(
      '$(plus) ' + nls.localize('force_org_list_clean_text')
    );
    const response = await orgList.setDefaultOrg();
    expect(response.type).to.equal('CONTINUE');
    const commandResult = expect(
      executeCommandStub.calledWith('sfdx.force.org.list.clean')
    ).to.be.true;
  });

  it('should return Continue and call force:config:set command if a username/alias is selected', async () => {
    orgListStub.returns(orgsList);
    quickPickStub.returns('$(plus)' + orgsList[0].split(' ', 1));
    const response = await orgList.setDefaultOrg();
    expect(response.type).to.equal('CONTINUE');
    const commandResult = expect(
      executeCommandStub.calledWith('sfdx.force.config.set')
    ).to.be.true;
  });
});
