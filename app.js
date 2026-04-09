(function () {
  "use strict";

  var e = React.createElement;

  var NAV_ITEMS = [
    { to: "/", label: "Quote", framePath: "public/legacy/quote/index.html", title: "Quote Tool" },
    { to: "/itinerary", label: "Itinerary", framePath: "public/legacy/itinerary_planner/index.html", title: "Itinerary" },
    { to: "/hotel-maker", label: "Hotel Maker", framePath: "public/legacy/hotel_maker/index.html", title: "Hotel Maker" },
    { to: "/gds-parser", label: "GDS Parser", framePath: "public/legacy/gds_parser/gds_parser.html", title: "GDS Parser" },
    { to: "/manual", label: "Manual", framePath: "public/legacy/manual/index.html", title: "Manual" },
    { to: "/itinerary-legacy", label: "Itinerary Legacy", framePath: "public/legacy/itinerary_planner/index.html", title: "Itinerary Legacy" },
    { to: "/hotel-maker-legacy", label: "Hotel Legacy", framePath: "public/legacy/hotel_maker/index.html", title: "Hotel Legacy" }
  ];

  function getBasePath() {
    var pathname = window.location.pathname || "/";
    if (!pathname.endsWith("/")) {
      pathname = pathname.slice(0, pathname.lastIndexOf("/") + 1);
    }
    return pathname;
  }

  function joinPath(path) {
    var clean = path.charAt(0) === "/" ? path.slice(1) : path;
    return getBasePath() + clean;
  }

  function currentRoute() {
    var hash = window.location.hash || "#/";
    var route = hash.replace(/^#/, "");
    if (!route) route = "/";
    if (route.charAt(0) !== "/") route = "/" + route;
    return route;
  }

  function ensureValidRoute(route) {
    var exists = NAV_ITEMS.some(function (item) {
      return item.to === route;
    });
    if (exists) return route;
    window.location.hash = "#/";
    return "/";
  }

  function ToolFrame(props) {
    return e(
      "section",
      { className: "tool-frame-wrap", "aria-label": props.title },
      e("iframe", {
        className: "tool-frame",
        src: joinPath(props.path),
        title: props.title,
        loading: "eager",
        referrerPolicy: "no-referrer"
      })
    );
  }

  function App() {
    var _React$useState = React.useState(ensureValidRoute(currentRoute())),
      route = _React$useState[0],
      setRoute = _React$useState[1];

    React.useEffect(function () {
      function onHashChange() {
        setRoute(ensureValidRoute(currentRoute()));
      }
      window.addEventListener("hashchange", onHashChange);
      return function () {
        window.removeEventListener("hashchange", onHashChange);
      };
    }, []);

    var current = NAV_ITEMS.find(function (item) {
      return item.to === route;
    }) || NAV_ITEMS[0];

    return e(
      "div",
      { className: "app-shell" },
      e("main", { className: "page-content" }, e(ToolFrame, { path: current.framePath, title: current.title }))
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(e(App));
})();
