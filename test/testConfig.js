/* eslint-disable max-len */
const chai = require('chai');
const fs = require('fs');
const path = require('path');
const defaultSettings = require('../proxy.config.json');

chai.should();
const expect = chai.expect;

describe('default configuration', function () {
  it('should use default values if no user-settings.json file exists', function () {
    const config = require('../src/config');

    expect(config.getAuthentication()).to.be.eql(
      defaultSettings.authentication[0],
    );
    expect(config.getDatabase()).to.be.eql(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).to.be.eql(
      defaultSettings.tempPassword,
    );
    expect(config.getAuthorisedList()).to.be.eql(
      defaultSettings.authorisedList,
    );
  });
  after(function () {
    delete require.cache[require.resolve('../src/config')];
  });
});

describe('user configuration', function () {
  let tempDir;
  let tempUserFile;

  beforeEach(function () {
    tempDir = fs.mkdtempSync('gitproxy-test');
    tempUserFile = path.join(tempDir, 'test-settings.json');
    require('../src/config/file').configFile = tempUserFile;
  });

  it('should override default settings for authorisedList', function () {
    const user = {
      authorisedList: [
        {
          project: 'foo',
          name: 'bar',
          url: 'https://github.com/foo/bar.git',
        },
      ],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getAuthorisedList()).to.be.eql(user.authorisedList);
    expect(config.getAuthentication()).to.be.eql(
      defaultSettings.authentication[0],
    );
    expect(config.getDatabase()).to.be.eql(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).to.be.eql(
      defaultSettings.tempPassword,
    );
  });

  it('should override default settings for authentication', function () {
    const user = {
      authentication: [
        {
          type: 'google',
          enabled: true,
        },
      ],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getAuthentication()).to.be.eql(user.authentication[0]);
    expect(config.getAuthentication()).to.not.be.eql(
      defaultSettings.authentication[0],
    );
    expect(config.getDatabase()).to.be.eql(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).to.be.eql(
      defaultSettings.tempPassword,
    );
  });

  it('should override default settings for database', function () {
    const user = {
      sink: [
        {
          type: 'postgres',
          enabled: true,
        },
      ],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getDatabase()).to.be.eql(user.sink[0]);
    expect(config.getDatabase()).to.not.be.eql(defaultSettings.sink[0]);
    expect(config.getAuthentication()).to.be.eql(
      defaultSettings.authentication[0],
    );
    expect(config.getTempPasswordConfig()).to.be.eql(
      defaultSettings.tempPassword,
    );
  });

  afterEach(function () {
    fs.rmSync(tempUserFile);
    fs.rmdirSync(tempDir);
    delete require.cache[require.resolve('../src/config')];
  });
});
