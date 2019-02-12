/**
 * External dependencies
 */
const WebpackRTLPlugin = require( 'webpack-rtl-plugin' );
const CopyWebpackPlugin = require( 'copy-webpack-plugin' );
const postcss = require( 'postcss' );

const { get } = require( 'lodash' );
const { basename } = require( 'path' );

/**
 * WordPress dependencies
 */
const CustomTemplatedPathPlugin = require( '@wordpress/custom-templated-path-webpack-plugin' );
const LibraryExportDefaultPlugin = require( '@wordpress/library-export-default-webpack-plugin' );
const { camelCaseDash, config } = require( '@wordpress/webpack-config' );

/**
 * Internal dependencies
 */
const { dependencies } = require( './package' );

const WORDPRESS_NAMESPACE = '@wordpress/';

const gutenbergPackages = Object.keys( dependencies )
	.filter( ( packageName ) => packageName.startsWith( WORDPRESS_NAMESPACE ) )
	.map( ( packageName ) => packageName.replace( WORDPRESS_NAMESPACE, '' ) );

config.entry = gutenbergPackages.reduce( ( memo, packageName ) => {
	const name = camelCaseDash( packageName );
	memo[ name ] = `./packages/${ packageName }`;
	return memo;
}, {} );

config.output = {
	filename: './build/[basename]/index.js',
	path: __dirname,
	library: [ 'wp', '[name]' ],
	libraryTarget: 'this',
};

config.plugins.push(
	// Create RTL files with a -rtl suffix
	new WebpackRTLPlugin( {
		suffix: '-rtl',
		minify: config.mode === 'production' ? { safe: true } : false,
	} ),
	new CustomTemplatedPathPlugin( {
		basename( path, data ) {
			let rawRequest;

			const entryModule = get( data, [ 'chunk', 'entryModule' ], {} );
			switch ( entryModule.type ) {
				case 'javascript/auto':
					rawRequest = entryModule.rawRequest;
					break;

				case 'javascript/esm':
					rawRequest = entryModule.rootModule.rawRequest;
					break;
			}

			if ( rawRequest ) {
				return basename( rawRequest );
			}

			return path;
		},
	} ),
	new LibraryExportDefaultPlugin( [
		'api-fetch',
		'deprecated',
		'dom-ready',
		'redux-routine',
		'token-list',
	].map( camelCaseDash ) ),
	new CopyWebpackPlugin(
		gutenbergPackages.map( ( packageName ) => ( {
			from: `./packages/${ packageName }/build-style/*.css`,
			to: `./build/${ packageName }/`,
			flatten: true,
			transform: ( content ) => {
				if ( config.mode === 'production' ) {
					return postcss( [
						require( 'cssnano' )( {
							preset: [ 'default', {
								discardComments: {
									removeAll: true,
								},
							} ],
						} ),
					] )
						.process( content, { from: 'src/app.css', to: 'dest/app.css' } )
						.then( ( result ) => result.css );
				}
				return content;
			},
		} ) )
	)
);

module.exports = config;
