import { Command, Helper, OptionsHelper } from '@dojo/cli/interfaces';
import * as spawn from 'cross-spawn';
import { copy } from 'cpx';
import * as fs from 'fs';
import * as ora from 'ora';
import * as os from 'os';
import { join, relative, sep } from 'path';
import * as rimraf from 'rimraf';
import * as webpack from 'webpack';
import { BuildArgs } from './interfaces';
import getConfig from './webpack.config';

const command: Command = {
	group: 'build',
	name: 'theme',
	description: 'create a distributable build of your Dojo theme',
	register(options: OptionsHelper) {
		options('name', {
			describe: 'The name of the theme. Used to set the filename of custom element-compatible builds.',
			alias: 'n'
		});

		options('release', {
			describe:
				'The version to use when generating custom element-compatible builds. Defaults to the package.json version.',
			alias: 'r'
		});
	},
	run(helper: Helper, args: BuildArgs) {
		const { name } = args;
		const basePath = process.cwd();
		const createTask = (callback: any) =>
			new Promise((resolve, reject) => {
				callback((error?: Error) => {
					if (error) {
						reject(error);
					}
					resolve();
				});
			});
		const createChildProcess = (command: string, args: string[], errorMessage: string) =>
			new Promise((resolve, reject) => {
				const child = spawn(join(basePath, 'node_modules', '.bin', command), args, { cwd: basePath });
				child.on('error', reject);
				child.on('exit', (code) => (code !== 0 ? reject(new Error(errorMessage)) : resolve()));
			});

		let tmpDir: string;
		const rmTmpDir = () => tmpDir && (fs.unlinkSync(join(tmpDir, 'tsconfig.json')), fs.rmdirSync(tmpDir));
		const spinner = ora(`building ${name} theme`).start();
		return createTask((callback: any) => rimraf(join('dist', 'src', name), callback))
			.then(() => createChildProcess('tcm', [join('src', name, '*.m.css')], 'Failed to build CSS modules'))
			.then(() =>
				createTask((callback: any) =>
					fs.mkdtemp(os.tmpdir() + sep, (error: Error | undefined, folder: string) => {
						if (error) {
							callback(error);
						} else {
							tmpDir = folder;
							const tsconfig = join(relative(tmpDir, ''), 'tsconfig.json');
							const include = join(relative(tmpDir, ''), 'src', name, '**', '*.ts');
							fs.writeFile(
								join(tmpDir, 'tsconfig.json'),
								`{ "extends": "${tsconfig}", "include": [ "${include}" ] }`,
								callback
							);
						}
					})
				)
			)
			.then(() =>
				createChildProcess(
					'tsc',
					['--outDir', join('dist', 'src', name), '--project', join(relative('', tmpDir), 'tsconfig.json')],
					`Failed to build ${name}/index.d.ts`
				)
			)
			.then(() =>
				createTask((callback: any) =>
					copy(join('src', name, '*.{d.ts,css}'), join('dist', 'src', name), callback)
				)
			)
			.then(() =>
				createTask((callback: any) =>
					copy(join('src', name, 'assets', '*'), join('dist', 'src', name, 'assets'), callback)
				)
			)
			.then(() =>
				createTask((callback: any) => {
					const compiler = webpack(getConfig(args));
					compiler.run(callback);
				})
			)
			.then(
				() => {
					spinner.succeed('build successful');
					rmTmpDir();
				},
				(error) => {
					spinner.fail(error);
					rmTmpDir();
				}
			);
	}
};

export default command;
