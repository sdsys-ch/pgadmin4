/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2022, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////
import React from 'react';
import pgAdmin from 'sources/pgadmin';
import getApiInstance from 'sources/api_instance';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Switch } from '@material-ui/core';
import { generateCollectionURL } from '../../browser/static/js/node_ajax';
import Notify from '../../static/js/helpers/Notifier';
import gettext from 'sources/gettext';
import 'wcdocker';
import PgTable from 'sources/components/PgTable';
import Theme from 'sources/Theme';
import PropTypes from 'prop-types';
import { PgIconButton } from '../../static/js/components/Buttons';

const useStyles = makeStyles((theme) => ({
  emptyPanel: {
    minHeight: '100%',
    minWidth: '100%',
    background: theme.palette.grey[400],
    overflow: 'auto',
    padding: '7.5px',
  },
  panelIcon: {
    width: '80%',
    margin: '0 auto',
    marginTop: '25px !important',
    position: 'relative',
    textAlign: 'center',
  },
  panelMessage: {
    marginLeft: '0.5rem',
    fontSize: '0.875rem',
  },
  searchPadding: {
    flex: 2.5
  },
  searchInput: {
    flex: 1,
    margin: '4 0 4 0',
    borderLeft: 'none',
    paddingLeft: 5
  },
  propertiesPanel: {
    height: '100%'
  },
  autoResizer: {
    height: '100% !important',
    width: '100% !important',
    background: theme.palette.grey[400],
    padding: '8px',
  },
  dropButton: {
    marginRight: '5px !important'
  },
  readOnlySwitch: {
    opacity: 0.75,
    '& .MuiSwitch-track': {
      opacity: theme.palette.action.disabledOpacity,
    }
  }
}));

export function CollectionNodeView({
  node,
  treeNodeInfo,
  itemNodeData,
  item,
  pgBrowser
}) {
  const classes = useStyles();

  const [data, setData] = React.useState([]);
  const [infoMsg, setInfoMsg] = React.useState('Please select an object in the tree view.');
  const [selectedObject, setSelectedObject] = React.useState([]);
  const [reload, setReload] = React.useState();

  const [pgTableColumns, setPgTableColumns] = React.useState([
    {
      Header: 'properties',
      accessor: 'Properties',
      sortble: true,
      resizable: false,
      disableGlobalFilter: false,
    },
    {
      Header: 'value',
      accessor: 'value',
      sortble: true,
      resizable: false,
      disableGlobalFilter: false,
    },
  ]);

  const getTableSelectedRows = (selRows) => {
    setSelectedObject(selRows);
  };

  const onDrop = (type) => {
    let selRowModels = selectedObject,
      selRows = [],
      selItem = pgBrowser.tree.selected(),
      selectedItemData = selItem ? pgBrowser.tree.itemData(selItem) : null,
      selNode = selectedItemData && pgBrowser.Nodes[selectedItemData._type],
      url = undefined,
      msg = undefined,
      title = undefined;

    if (selNode && selNode.type && selNode.type == 'coll-constraints') {
      // In order to identify the constraint type, the type should be passed to the server
      selRows = selRowModels.map((row) => ({
        id: row.get('oid'),
        _type: row.get('_type'),
      }));
    } else {
      selRows = selRowModels.map((row) => row.original.oid);
    }

    if (selRows.length === 0) {
      Notify.alert(
        gettext('Drop Multiple'),
        gettext('Please select at least one object to delete.')
      );
      return;
    }

    if (!selNode) return;

    if (type === 'dropCascade') {
      url = selNode.generate_url(selItem, 'delete');
      msg = gettext(
        'Are you sure you want to drop all the selected objects and all the objects that depend on them?'
      );
      title = gettext('DROP CASCADE multiple objects?');
    } else {
      url = selNode.generate_url(selItem, 'drop');
      msg = gettext('Are you sure you want to drop all the selected objects?');
      title = gettext('DROP multiple objects?');
    }

    const api = getApiInstance();
    let dropNodeProperties = function () {
      api
        .delete(url, {
          data: JSON.stringify({ ids: selRows }),
          contentType: 'application/json; charset=utf-8',
        })
        .then(function (res) {
          if (res.success == 0) {
            pgBrowser.report_error(res.errormsg, res.info);
          } else {
            pgBrowser.Events.trigger(
              'pgadmin:browser:tree:refresh',
              selItem || pgBrowser.tree.selected(),
              {
                success: function () {
                  pgBrowser.tree.select(selItem);
                  selNode.callbacks.selected.apply(selNode, [selItem]);
                },
              }
            );
          }
          setReload(true);
        })
        .catch(function (error) {
          Notify.error(
            gettext('Error dropping %s', selectedItemData._label.toLowerCase()),
            error.message
          );
        });
    };

    if (confirm) {
      Notify.confirm(title, msg, dropNodeProperties, null);
    } else {
      dropNodeProperties();
    }
  };

  React.useEffect(() => {
    if (node){

      let nodeObj =
      pgAdmin.Browser.Nodes[itemNodeData?._type.replace('coll-', '')];

      let schema = nodeObj.getSchema.call(nodeObj, treeNodeInfo, itemNodeData);
      let url = generateCollectionURL.call(nodeObj, item, 'properties');

      const api = getApiInstance();

      let tableColumns = [];
      var column = {};

      if (itemNodeData._type.indexOf('coll-') > -1) {
        schema.fields.forEach((field) => {
          if (node.columns.indexOf(field.id) > -1) {
            if (field.label.indexOf('?') > -1) {
              column = {
                Header: field.label,
                accessor: field.id,
                sortble: true,
                resizable: false,
                disableGlobalFilter: false,
                // eslint-disable-next-line react/display-name
                Cell: ({ value }) => {
                  return (<Switch color="primary" checked={value} className={classes.readOnlySwitch} value={value} readOnly title={String(value)} />);
                }
              };
            } else {
              column = {
                Header: field.label,
                accessor: field.id,
                sortble: true,
                resizable: false,
                disableGlobalFilter: false,
              };
            }
            tableColumns.push(column);
          }
        });
        api({
          url: url,
          type: 'GET',
        })
          .then((res) => {
            res.data.forEach((element) => {
              element['icon'] = '';
            });
            setPgTableColumns(tableColumns);
            setData(res.data);
            setInfoMsg('No properties are available for the selected object.');
          })
          .catch((err) => {
            Notify.alert(
              gettext('Failed to retrieve data from the server.'),
              gettext(err.message)
            );
          });
      }
    }
  }, [itemNodeData, node, item, reload]);

  const customHeader = () => {
    return (
      <Box >
        <PgIconButton
          className={classes.dropButton}
          variant="outlined"
          icon={<i className='fa fa-trash-alt delete_multiple' aria-hidden="true" role="img"></i>}
          aria-label="Delete/Drop"
          title={gettext('Delete/Drop')}
          onClick={() => {
            onDrop('drop');
          }}
          disabled={
            (selectedObject.length > 0)
              ? !node.canDrop
              : true
          }
        ></PgIconButton>
        <PgIconButton
          className={classes.dropButton}
          variant="outlined"
          icon={<i className='pg-font-icon icon-drop_cascade delete_multiple_cascade' aria-hidden="true" role="img"></i>}
          aria-label="Drop Cascade"
          title={gettext('Drop Cascade')}
          onClick={() => {
            onDrop('dropCascade');
          }}
          disabled={
            (selectedObject.length > 0)
              ? !node.canDropCascade
              : true
          }
        ></PgIconButton>
      </Box>);
  };

  return (
    <Theme>
      <Box className={classes.propertiesPanel}>
        {data.length > 0 ?
          (
            <PgTable
              isSelectRow={!('catalog' in treeNodeInfo) && (itemNodeData.label !== 'Catalogs')}
              customHeader={customHeader}
              className={classes.autoResizer}
              columns={pgTableColumns}
              data={data}
              type={'panel'}
              isSearch={false}
              getSelectedRows={getTableSelectedRows}
            />
          )
          :
          (
            <div className={classes.emptyPanel}>
              <div className={classes.panelIcon}>
                <i className="fa fa-exclamation-circle"></i>
                <span className={classes.panelMessage}>{gettext(infoMsg)}</span>
              </div>
            </div>

          )
        }
      </Box>
    </Theme>
  );
}

CollectionNodeView.propTypes = {
  node: PropTypes.func,
  itemData: PropTypes.object,
  itemNodeData: PropTypes.object,
  treeNodeInfo: PropTypes.object,
  item: PropTypes.object,
  pgBrowser: PropTypes.object,
  preferences: PropTypes.object,
  sid: PropTypes.number,
  did: PropTypes.number,
  row: PropTypes.object,
  serverConnected: PropTypes.bool,
  value: PropTypes.bool,
};