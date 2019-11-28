import * as webpack from 'webpack';

import configFactory from './webpack.config';

export default function webpackConfig(): webpack.Configuration {
	const rc = require('./build-options.json');
	return configFactory(rc);
}
