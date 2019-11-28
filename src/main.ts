import { Command, EjectOutput, Helper, OptionsHelper } from '@dojo/cli/interfaces';
import * as ora from 'ora';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as webpack from 'webpack';
import chalk from 'chalk';
import configFactory from './webpack.config';
import logger from './logger';
const pkgDir = require('pkg-dir');

function clearBuildOptions(key: string): any {
	const rcPath = path.join(process.cwd(), '.dojorc');
	if (fs.existsSync(rcPath)) {
		const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
		const config = rc[key] || {};
		rc[key] = {};
		fs.writeFileSync(rcPath, JSON.stringify(rc));
		return config;
	}
	return {};
}

function moveBuildOptions(key: string): string {
	const tmpDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
	const tmpRc = path.join(tmpDir, 'build-options.json');
	const rc = clearBuildOptions(key);
	fs.writeFileSync(tmpRc, JSON.stringify(rc));
	return tmpRc;
}

function buildNpmDependencies(): any {
	try {
		const packagePath = pkgDir.sync(__dirname);
		const packageJsonFilePath = path.join(packagePath, 'package.json');
		const packageJson = require(packageJsonFilePath);

		return {
			[packageJson.name]: packageJson.version,
			...packageJson.dependencies
		};
	} catch (e) {
		throw new Error(`Failed reading dependencies from package.json - ${e.message}`);
	}
}

interface BuildArgs {
	themePath: string;
	themes: string[];
	release: string;
}

const command: Command = {
	group: 'build',
	name: 'theme',
	description: 'Create a theme build',
	register(options: OptionsHelper) {
		options('release', {
			describe: 'the release version number',
			alias: 'r',
			type: 'string'
		});
	},
	run(helper: Helper, args: BuildArgs) {
		console.log = () => {};
		const config = configFactory(args);
		const compiler = webpack([config]);
		const spinner = ora('building').start();
		return new Promise<void>((resolve, reject) => {
			compiler.run((err, stats) => {
				spinner.stop();
				if (err) {
					reject(err);
				}
				if (stats) {
					logger(stats.toJson(), config);
				}

				resolve();
			});
		});
	},
	eject(helper: Helper): EjectOutput {
		return {
			copy: {
				path: __dirname,
				files: [
					moveBuildOptions(`${this.group}-${this.name}`),
					'./webpack.config.js',
					'./ejected.config.js',
					'template/theme-installer.js'
				]
			},
			hints: [
				`to build run ${chalk.underline(
					'./node_modules/.bin/webpack --config ./config/build-theme/ejected.config.js'
				)}`
			],
			npm: {
				devDependencies: { ...buildNpmDependencies() }
			}
		};
	}
};
export default command;
