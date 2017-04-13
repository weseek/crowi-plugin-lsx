import React from 'react';
import urlgrey from 'urlgrey';

import styles from '../../css/index.css';

import { LsxContext } from '../util/LsxContext';
import { LsxCacheHelper } from '../util/LsxCacheHelper';
import { PageNode } from './PageNode';
import { ListView } from './PageList/ListView';

export class Lsx extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      isLoading: true,
      isError: false,
      nodeTree: undefined,
      errorMessage: '',
    };
  }

  componentDidMount() {
    // check cache exists
    if (this.props.lsxStateCache) {
      this.setState({
        isLoading: false,
        nodeTree: this.props.lsxStateCache.nodeTree,
        isError: this.props.lsxStateCache.isError,
        errorMessage: this.props.lsxStateCache.errorMessage,
      });
      return;   // go to render()
    }

    const lsxContext = this.props.lsxContext;
    lsxContext.parse();

    let pagePath = lsxContext.pagePath;

    this.props.crowi.apiGet('/plugins/lsx', {pagePath, queryOptions: ''})
      .catch(error => {
        const errorMessage = error.response.data.error.message;
        this.setState({ isError: true, errorMessage: errorMessage });
      })
      .then((res) => {
        if (res.ok) {
          const nodeTree = this.generatePageNodeTree(pagePath, res.pages);
          this.setState({ nodeTree });
        }
        else {
          return Promise.reject(res.error);
        }
      })
      // finally
      .then(() => {
        this.setState({ isLoading: false });

        // store to sessionStorage
        const cacheKey = LsxCacheHelper.generateCacheKeyFromContext(lsxContext);
        LsxCacheHelper.cacheState(cacheKey, this.state);
      })
  }

  /**
   * generate tree structure
   *
   * @param {string} rootPagePath
   * @param {Page[]} pages Array of Page model
   *
   * @memberOf Lsx
   */
  generatePageNodeTree(rootPagePath, pages) {
    let pathToNodeMap = {};

    pages.forEach((page) => {
      // add slash ensure not to forward match to another page
      // ex: '/Java/' not to match to '/JavaScript'
      const pagePath = this.addSlashOfEnd(page.path);

      // exclude rootPagePath itself
      if (this.isEquals(pagePath, rootPagePath)) {
        return;
      }

      const node = pathToNodeMap[pagePath] || new PageNode();
      node.page = page;
      pathToNodeMap[pagePath] = node;

      // get or create parent node
      const parentPath = this.getParentPath(pagePath);
      // associate to patent but exclude direct child of rootPagePath
      if (!this.isEquals(parentPath, rootPagePath)) {
        let parentNode = pathToNodeMap[parentPath];
        if (parentNode === undefined) {
          parentNode = new PageNode();
          pathToNodeMap[parentPath] = parentNode;
        }
        // associate to patent
        parentNode.children.push(node);
      }
    });

    // return root objects
    return Object.values(pathToNodeMap).filter((node) => {
      const parentPath = this.getParentPath(node.page.path);
      return !(parentPath in pathToNodeMap);
    });
  }

  /**
   * return path that added slash to the end for specified path
   *
   * @param {string} path
   * @returns
   *
   * @memberOf LsxContext
   */
  addSlashOfEnd(path) {
    let returnPath = path;
    if (!path.match(/\/$/)) {
      returnPath += '/';
    }
    return returnPath;
  }

  /**
   * addSlashOfEnd and compare whether path1 and path2 is the same
   *
   * @param {string} path1
   * @param {string} path2
   * @returns
   *
   * @memberOf Lsx
   */
  isEquals(path1, path2) {
    return this.addSlashOfEnd(path1) === this.addSlashOfEnd(path2)
  }

  getParentPath(path) {
    const parent = urlgrey(path).parent();
    return decodeURIComponent(this.addSlashOfEnd(parent.path()));

  }

  render() {
    const lsxContext = this.props.lsxContext;

    if (this.state.isLoading) {
      return (
        <div className="text-muted">
          <i className="fa fa-spinner fa-pulse fa-fw"></i>
          <span className={styles.lsxBlink}>{lsxContext.tagExpression}</span>
        </div>
      );
    }
    if (this.state.isError) {
      return (
        <div className="text-warning">
          <i className="fa fa-exclamation-triangle fa-fw"></i>
          {lsxContext.tagExpression} (-> <small>{this.state.errorMessage})</small>
        </div>
      )
    }
    // render tree
    else {
      return <ListView nodeTree={this.state.nodeTree} lsxContext={this.props.lsxContext} />
    }
  }
}

Lsx.propTypes = {
  crowi: React.PropTypes.object.isRequired,

  lsxContext: React.PropTypes.instanceOf(LsxContext).isRequired,
  lsxStateCache: React.PropTypes.object,
};
