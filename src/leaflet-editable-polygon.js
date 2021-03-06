L.Polygon.polygonEditor = L.Polygon.extend({
    _prepareMapIfNeeded: function() {
        var that = this;

        if(this._map._editablePolygons != null) {
            return;
        }

        // Container for all editable polylines on this map:
        this._map._editablePolygons = [];

        // Click anywhere on map to add a new point-polyline:
        if(this._options.newPolygons) {
            // console.log('click na map');
            that._map.on('click', function(event) {
                // console.log('click, target=' + (event.target == that._map) + ' type=' + event.type);
                if(that.isBusy())
                    return;

                that._setBusy(true);

                var latLng = event.latlng;
                if(that._options.newPolygonConfirmMessage)
                    if(!confirm(that._options.newPolygonConfirmMessage))
                        return

                var contexts = [{'originalPolygonNo': null, 'originalPointNo': null}];
                L.Polygon.PolygonEditor([latLng], that._options, contexts).addTo(that._map);

                that._setBusy(false);

                that._showBoundMarkers();
            });
        }
    },
    /**
     * Will add all needed methods to this polyline.
     */
    _addMethods: function() {
        var that = this;

        this._init = function(options, contexts) {
            this._prepareMapIfNeeded();

            /*
             * Utility method added to this map to retreive editable 
             * polylines.
             */
            if(!this._map.getEditablePolylines) {
                this._map.getEditablePolylines = function() {
                    return that._map._editablePolygons;
                }
            }

            /**
             * Since all point editing is done by marker events, markers 
             * will be the main holder of the polyline points locations.
             * Every marker contains a reference to the newPointMarker 
             * *before* him (=> the first marker has newPointMarker=null).
             */
            this._parseOptions(options);

            this._setMarkers();

            var map = this._map;
            this._map.on("zoomend", function(e) {
                that._showBoundMarkers();
            });
            this._map.on("moveend", function(e) {
                that._showBoundMarkers();
            });

            if('_desiredPolygonNo' in this) {
                this._map._editablePolygons.splice(this._desiredPolygonNo, 0, this);
            } else {
                this._map._editablePolygons.push(this);
            }
        };

        /**
         * Check if there is *any* busy editable polyline on this map.
         */
        this.isBusy = function() {
            for(var i = 0; i < that._map._editablePolygons.length; i++)
                if(that._map._editablePolygons[i]._isBusy())
                    return true;

            return false;
        };

        /**
         * Check if is busy adding/moving new nodes. Note, there may be 
         * *other* editable polylines on the same map which *are* busy.
         */
        this._isBusy = function() {
            return that._busy;
        };

        this._setBusy = function(busy) {
            that._busy = busy;
        };

        /**
         * Get markers for this polyline.
         */
        this.getPoints = function() {
            return this._markers;
        };

        this._parseOptions = function(options) {
            if(!options)
                options = {};

            // Do not show edit markers if more than maxMarkers would be shown:
            if(!('maxMarkers' in options)) {
                options.maxMarkers = 100;
            }
            this.maxMarkers = options.maxMarkers;

            // Do not allow edges to be destroyed (split polygon in two)
            if(!('deletableEdges' in options)) {
                options.deletableEdges = false;
            }
            this.deletableEdges = options.deletableEdges;


            // Icons:
            if(options.pointIcon) {
                this.pointIcon = options.pointIcon;
            } else {
                this.pointIcon = L.icon({ iconUrl: 'editmarker.png', iconSize: [11, 11], iconAnchor: [6, 6] });
            }
            if(options.newPointIcon) {
                this.newPointIcon = options.newPointIcon;
            } else {
                this.newPointIcon = L.icon({ iconUrl: 'editmarker2.png', iconSize: [11, 11], iconAnchor: [6, 6] });
            }
        };

        /**
         * Show only markers in current map bounds *is* there are only a certain 
         * number of markers. This method is called on eventy that change map 
         * bounds.
         */
        this._showBoundMarkers = function() {
            if(that.isBusy()) {
                //console.log('Do not show because busy!');
                return;
            }

            var bounds = that._map.getBounds();
            var found = 0;
            for(var polygonNo in that._map._editablePolygons) {
                var polyline = that._map._editablePolygons[polygonNo];
                for(var markerNo in polyline._markers) {
                    var marker = polyline._markers[markerNo];
                    if(bounds.contains(marker.getLatLng()))
                        found += 1;
                }
            }

            //console.log('found=' + found);

            for(var polygonNo in that._map._editablePolygons) {
                var polyline = that._map._editablePolygons[polygonNo];
                for(var markerNo in polyline._markers) {
                    var marker = polyline._markers[markerNo];
                    if(found < that.maxMarkers) {
                        that._setMarkerVisible(marker, bounds.contains(marker.getLatLng()));
                        that._setMarkerVisible(marker.newPointMarker, bounds.contains(marker.getLatLng()));
                    } else {
                        that._setMarkerVisible(marker, false);
                        that._setMarkerVisible(marker.newPointMarker, false);
                    }
                }
            }
        };

        /**
         * Used when adding/moving points in order to disable the user to mess 
         * with other markers (+ easier to decide where to put the point 
         * without too many markers).
         */
        this._hideAll = function(except) {
            for(var polygonNo in that._map._editablePolygons) {
                //console.log("hide " + polygonNo + " markers");
                var polyline = that._map._editablePolygons[polygonNo];
                for(var markerNo in polyline._markers) {
                    var marker = polyline._markers[markerNo];
                    if(except == null || except != marker)
                        polyline._setMarkerVisible(marker, false);
                    if(except == null || except != marker.newPointMarker)
                        polyline._setMarkerVisible(marker.newPointMarker, false);
                }
            }
        }

        /**
         * Show/hide marker.
         */
        this._setMarkerVisible = function(marker, show) {
            if(!marker)
                return;

            var map = this._map;
            if(show) {
                if(!marker._visible) {
                    if(!marker._map) { // First show fo this marker:
                        marker.addTo(map);
                    } else { // Marker was already shown and hidden:
                        map.addLayer(marker);
                    }
                    marker._map = map;
                }
                marker._visible = true;
            } else {
                if(marker._visible) {
                    map.removeLayer(marker);
                }
                marker._visible = false;
            }
        };

        this.updateLatLngs = function (latlngs) {
            this._eraseMarkers();
            this.setLatLngs(latlngs);
            that._setMarkers();
            this._reloadPolygon();
            return this;
        }

        /**
         * Reload polyline. If it is busy, then the bound markers will not be 
         * shown. Call _setBusy(false) before this method!
         */
        this._reloadPolygon = function(fixAroundPointNo) {
            // that._setMarkers();
            that.setLatLngs(that._getMarkerLatLngs());
            if(fixAroundPointNo != null)
                that._fixNeighbourPositions(fixAroundPointNo);
            that._showBoundMarkers();
        }

        /**
         * Reload polyline. If it is busy, then the bound markers will not be 
         * shown. Call _setBusy(false) before this method!
         */
        this._setMarkers = function() {
            this._markers = [];
            var that = this;
            var points = this.getLatLngs();
            var length = points.length;
            for(var i = 0; i < length; i++) {
                var marker = this._addMarkers(i, points[i]);
                if(! ('context' in marker)) {
                    marker.context = {}
                    if(that._contexts != null) {
                        marker.context = contexts[i];
                    }
                }

                if(marker.context && ! ('originalPointNo' in marker.context))
                    marker.context.originalPointNo = i;
                if(marker.context && ! ('originalPolygonNo' in marker.context))
                    marker.context.originalPolygonNo = that._map._editablePolygons.length;
            }
        }

        /**
         * Reload polyline. If it is busy, then the bound markers will not be 
         * shown. Call _setBusy(false) before this method!
         */
        this._eraseMarkers = function() {
            var that = this;
            var points = this._markers;
            var length = points.length;
            for(var i = 0; i < length; i++) {
                var marker = points[i];
                this._map.removeLayer(marker.newPointMarker);
                this._map.removeLayer(marker);
            }
            this._markers = [];
        }

        /**
         * Add two markers (a point marker and his newPointMarker) for a 
         * single point.
         *
         * Markers are not added on the map here, the marker.addTo(map) is called 
         * only later when needed first time because of performance issues.
         */
        this._addMarkers = function(pointNo, latLng, fixNeighbourPositions) {
            var that = this;
            var points = this.getLatLngs();
            var marker = L.marker(latLng, {draggable: true, icon: this.pointIcon});

            marker.newPointMarker = null;
            marker.on('dragstart', function(event) {
                var pointNo = that._getPointNo(event.target);
                //console.log("pointNo", pointNo);
                var previousPoint = pointNo == null ? null : (pointNo - 1 >= 0 ? that._markers[pointNo - 1].getLatLng() : that._markers[that._markers.length - 1].getLatLng());
                var nextPoint = pointNo < that._markers.length - 1 ? that._markers[pointNo + 1].getLatLng() : that._markers[0].getLatLng();
                that._setupDragLines(marker, previousPoint, nextPoint);
                that._setBusy(true);
                that._hideAll(marker);
            });
            marker.on('dragend', function(event) {
                var marker = event.target;
                var pointNo = that._getPointNo(event.target);
                setTimeout(function() {
                    that._setBusy(false);
                    that._reloadPolygon(pointNo);
                }, 25);
            });
            // deleting in click and context menu to allow for touch device tap-to-remove
            marker.on('contextmenu dblclick', function(event) {
                var corners = that._markers.length;
                if (corners <= 3)
                    return;
                var marker = event.target;
                var pointNo = that._getPointNo(event.target);
                //console.log("corners:", corners, "pointNo:", pointNo);
                that._map.removeLayer(marker);
                that._map.removeLayer(newPointMarker);
                that._markers.splice(pointNo, 1);
                that._reloadPolygon(pointNo);
            });
            // marker.on('click', function(event) {
            //     //console.log("click");
            //     var marker = event.target;
            //     var pointNo = that._getPointNo(event.target);
            //     if(pointNo == 0 || pointNo == that._markers.length - 1) {
            //         that._prepareForNewPoint(marker, pointNo == 0 ? 0 : pointNo + 1);
            //     }
            // });

            var previousPoint = points[pointNo == 0 ? points.length - 1 : pointNo - 1];
            var newPointMarker = L.marker([(latLng.lat + previousPoint.lat) / 2.,
                                           (latLng.lng + previousPoint.lng) / 2.],
                                          {draggable: true, icon: this.newPointIcon});
            marker.newPointMarker = newPointMarker;
            newPointMarker.on('dragstart', function(event) {
                var pointNo = that._getPointNo(event.target);
                //console.log("pointNo", pointNo);
                var previousPoint = pointNo - 1 >= 0 ? that._markers[pointNo - 1].getLatLng() : that._markers[that._markers.length - 1].getLatLng();
                var nextPoint = that._markers[pointNo].getLatLng();
                that._setupDragLines(marker.newPointMarker, previousPoint, nextPoint);

                that._setBusy(true);
                that._hideAll(marker.newPointMarker);
            });
            newPointMarker.on('dragend', function(event) {
                var marker = event.target;
                var pointNo = that._getPointNo(event.target);
                that._addMarkers(pointNo, marker.getLatLng(), true);
                setTimeout(function() {
                    that._setBusy(false);
                    that._reloadPolygon();
                }, 25);
            });

            if (this._options.deletableEdges) {
                newPointMarker.on('contextmenu', function(event) {
                    // 1. Remove this polyline from map
                    var marker = event.target;
                    var pointNo = that._getPointNo(marker);
                    var markers = that.getPoints();
                    that._hideAll();

                    var secondPartMarkers = that._markers.slice(pointNo, pointNo.length);
                    that._markers.splice(pointNo, that._markers.length - pointNo);

                    that._reloadPolygon();

                    var points = [];
                    var contexts = [];
                    for(var i = 0; i < secondPartMarkers.length; i++) {
                        var marker = secondPartMarkers[i];
                        points.push(marker.getLatLng());
                        contexts.push(marker.context);
                    }

                    //console.log('points:' + points);
                    //console.log('contexts:' + contexts);

                    // Need to know the current polyline order numbers, because 
                    // the splitted one need to be inserted immediately after:
                    var originalPolygonNo = that._map._editablePolygons.indexOf(that);

                    var newPolygon = L.Polygon.PolygonEditor(points, that._options, contexts, originalPolygonNo + 1)
                                                .addTo(that._map);

                    that._showBoundMarkers();

                    //console.log('Done split, _editablePolygons now:' + that._map._editablePolygons.length);
                });
            }

            this._markers.splice(pointNo, 0, marker);

            if(fixNeighbourPositions) {
                this._fixNeighbourPositions(pointNo);
            }

            return marker;
        };

        /**
         * Event handlers for first and last point.
         */
        this._prepareForNewPoint = function(marker, pointNo) {
            that._hideAll();
            that._setupDragLines(marker, marker.getLatLng());
            var mouseMoveHandler = function(event) {
                that._setBusy(true);
            };
            that._map.on('mousemove', mouseMoveHandler);
            that._map.once('click', function(event) {
                //console.log('dodajemo na ' + pointNo + ' - ' + event.latlng);
                that._map.off('mousemove', mouseMoveHandler);
                that._addMarkers(pointNo, event.latlng, true);
                that._setBusy(false);
                that._reloadPolygon();
            });
        };

        /**
         * Fix nearby new point markers when the new point is created.
         */
        this._fixNeighbourPositions = function(pointNo) {
            var previousMarker = pointNo == 0 ? this._markers[this._markers.length - 1] : this._markers[pointNo - 1];
            var marker = this._markers[pointNo];
            var nextMarker = pointNo < this._markers.length - 1 ? this._markers[pointNo + 1] : this._markers[0];
            //console.log("_fixNeighbourPositions:", pointNo, this._markers.length);
            //console.log("markers:", marker, previousMarker, nextMarker);
            if(!marker && previousMarker && nextMarker) {
                // //console.log("last point deleted!");
                nextMarker.newPointMarker.setLatLng([(previousMarker.getLatLng().lat + nextMarker.getLatLng().lat) / 2.,
                                                     (previousMarker.getLatLng().lng + nextMarker.getLatLng().lng) / 2.]);
            }
            if(marker && previousMarker) {
                // //console.log("marker && previousMarker");
                marker.newPointMarker.setLatLng([(previousMarker.getLatLng().lat + marker.getLatLng().lat) / 2.,
                                                 (previousMarker.getLatLng().lng + marker.getLatLng().lng) / 2.]);
            }
            if(marker && nextMarker) {
                // //console.log("marker && nextMarker");
                nextMarker.newPointMarker.setLatLng([(marker.getLatLng().lat + nextMarker.getLatLng().lat) / 2.,
                                                     (marker.getLatLng().lng + nextMarker.getLatLng().lng) / 2.]);
            }
        };

        /**
         * Find the order number of the marker.
         */
        this._getPointNo = function(marker) {
            for(var i = 0; i < this._markers.length; i++) {
                if(marker == this._markers[i] || marker == this._markers[i].newPointMarker) {
                    return i;
                }
            }
            return -1;
        };

        /**
         * Get polyline latLngs based on marker positions.
         */
        this._getMarkerLatLngs = function() {
            var result = [];
            for(var i = 0; i < this._markers.length; i++)
                result.push(this._markers[i].getLatLng());
            return result;
        };

        this._setupDragLines = function(marker, point1, point2) {
            // //console.log("_setupDragLines", marker, point1, point2);
            var line1 = null;
            var line2 = null;
            if(point1) line1 = L.polygon([marker.getLatLng(), point1], {dashArray: "5,5", weight: 1})
                                .addTo(that._map);
            if(point2) line2 = L.polygon([marker.getLatLng(), point1], {dashArray: "5,5", weight: 1})
                                .addTo(that._map);

            var moveHandler = function(event) {
                if(line1)
                    line1.setLatLngs([event.latlng, point1]);
                if(line2)
                    line2.setLatLngs([event.latlng, point2]);
            };

            var stopHandler = function(event) {
                that._map.off('mousemove', moveHandler);
                marker.off('dragend', stopHandler);
                if(line1) that._map.removeLayer(line1);
                if(line2) that._map.removeLayer(line2);
                //console.log('STOPPED');
                if(event.target != that._map) {
                    that._map.fire('click', event);
                }
            };

            that._map.on('mousemove', moveHandler);
            marker.on('dragend', stopHandler);

            that._map.once('click', stopHandler);
            marker.once('click', stopHandler);
            if(line1) line1.once('click', stopHandler);
            if(line2) line2.once('click', stopHandler);
        }
    }
});

L.Polygon.polygonEditor.addInitHook(function () {
    // Hack to keep reference to map:
    this.originalAddTo = this.addTo;
    this.addTo = function(map) {
        this.originalAddTo(map);
        this._map = map;

        this._addMethods();

        /**
         * When addint a new point we must disable the user to mess with other 
         * markers. One way is to check everywhere if the user is busy. The 
         * other is to just remove other markers when the user is doing 
         * somethinng.
         *
         * TODO: Decide the right way to do this and then leave only _busy or 
         * _hideAll().
         */
        this._busy = false;
        this._initialized = false;

        this._init(this._options, this._contexts);

        this._initialized = true;

        return this;
    };
});

/**
 * Construct a new editable polyline.
 *
 * latlngs    ... a list of points (or two-element tuples with coordinates)
 * options    ... polyline options
 * contexts   ... custom contexts for every point in the polyline. Must have the 
 *                same number of elements as latlngs and this data will be 
 *                preserved when new points are added or polylines splitted.
 * polygonNo ... insert this polyline in a specific order (used when splitting).
 *
 * More about contexts:
 * This is an array of objects that will be kept as "context" for every 
 * point. Marker will keep this value as marker.context. New markers will 
 * have context set to null.
 *
 * Contexts must be the same size as the polyline size!
 *
 * By default, even without calling this method -- every marker will have 
 * context with one value: marker.context.originalPointNo with the 
 * original order number of this point. The order may change if some 
 * markers before this one are delted or new added.
 */
L.Polygon.PolygonEditor = function(latlngs, options, contexts, polygonNo) {
    var result = new L.Polygon.polygonEditor(latlngs, options);
    result._options = options;
    result._contexts = contexts;
    result._desiredPolygonNo = polygonNo
    return result;
};
