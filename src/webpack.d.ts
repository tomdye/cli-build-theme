import * as webpack from 'webpack';

declare module 'webpack' {
	interface Chunk {
		name?: string;
	}
}

