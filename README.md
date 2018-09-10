# cli-build-theme

A [`@dojo/cli`](https://github.com/dojo/cli) command for building [Dojo](https://dojo.io) themes that are intended for distribution.

If you are a theme author and need to distribute your theme files across multiple applications, then `@dojo/cli-build-theme` helps you do so. The build outputs the processed CSS modules, CSS source maps, an `index.js` theme module with a corresponding `.d.ts`, as well as any associated assets. The ouput also includes versioned `index.css` and `index.js` equivalents that are compatible with Dojo custom elements.

>Note: if you are using [ `dojo create theme`](https://github.com/dojo/cli-create-theme) within an existing application or Dojo custom element, then there is no need to use this package. As long as the theme files are within the existing build pipeline, they will be included in the build generated with [`@dojo/cli-build-app`](https://github.com/dojo/cli-build-app) or [`@dojo/cli-build-widget`](https://github.com/dojo/cli-build-widget);

- [Usage](#usage)
- [How do I contribute?](#how-do-i-contribute)
- [Licensing information](#licensing-information)

## Usage

To use `@dojo/cli-build-theme` in a themes project, first install `@dojo/cli` globally (if you have not already done so), and then install the package:

```bash
npm install --global @dojo/cli
npm install --save-dev @dojo/cli-build-theme
```

To build a theme, run `dojo build theme` from the command line, specifying the theme `name` as well as an optional `release` version.

```bash
dojo build theme --name=my-theme --release=1.2.3
```

If no `release` is specified, then the version from `package.json` will be used. Both `name` and `release` are aliased as `n` and `r`, respectively, so the above command can be shortened to:

```bash
dojo build theme -n my-theme -r 1.2.3
```

The above will create a new `dist/src/my-theme` directory at the project root that contains:

- All raw `.m.css` files. Copying these files as-is enables composition (i.e., `composes: root from 'node_modules/my-theme/my-widget'`)
- An `assets` directory containing all fonts and images included within the theme's directory
- An `index.js` file that can be imported into Dojo widgets and passed to the [`@theme` decorator](https://github.com/dojo/framework/blob/master/src/widget-core/README.md#styling--theming)
- An `index.css` file that is imported into an application's `main.css`
- A `{name}-{release}.js` file for use with custom elements that registers the theme with a global registry and is added via a `<script>` tag
- A `{name}-{release}.css` file for use with custom elements that is added via a `<link rel="stylesheet">` tag

## How do I contribute?

We appreciate your interest! Please see the [Dojo Meta Repository](https://github.com/dojo/meta#readme) for the Contributing Guidelines.

## Licensing information

© 2018 [JS Foundation](https://js.foundation/). [New BSD](http://opensource.org/licenses/BSD-3-Clause) license.
