import * as stringArgv from 'string-argv';
import { runCommandFromGithubAction } from './index.js';
import Context from './context.js';
import * as commands from './commands.js';

describe('runCommandFromGithubAction', () => {
  const labelSpy = jest.spyOn(commands, 'label').mockImplementation(jest.fn());
  const parseArgsSpy = jest.spyOn(stringArgv, 'parseArgsStringToArgv');

  // mocking some of the Context object
  const onDoneSpy = jest.spyOn(Context.prototype, 'onDone');
  const doneCommentSpy = jest.spyOn(Context.prototype, 'doneComment');
  jest.spyOn(Context.prototype, 'createComment').mockImplementation(jest.fn());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should strip the command', async () => {
    await runCommandFromGithubAction('  @supersetbot label test-label  ');
    expect(parseArgsSpy).toHaveBeenCalledWith('supersetbot label test-label');

    await runCommandFromGithubAction('  \n  @supersetbot label test-label  \n \n   \n');
    expect(parseArgsSpy).toHaveBeenCalledWith('supersetbot label test-label');

    await runCommandFromGithubAction('  \n \t@supersetbot label test-label \t  \n \n\t   \n');
    expect(parseArgsSpy).toHaveBeenCalledWith('supersetbot label test-label');
  });

  it('should parse the raw command correctly and call commands.label and context.onDone', async () => {
    await runCommandFromGithubAction('@supersetbot label test-label');

    expect(labelSpy).toHaveBeenCalled();
    expect(onDoneSpy).toHaveBeenCalled();
  });

  it('should generate a good comment message', async () => {
    await runCommandFromGithubAction('@supersetbot label test-label');
    const comment = doneCommentSpy.mock.results[0].value;
    expect(comment).toContain('> `supersetbot label test-label`');
  });
});
