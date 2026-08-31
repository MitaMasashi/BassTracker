import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { AnalysisPage } from "../pages/AnalysisPage";
import { EarCopyPage } from "../pages/EarCopyPage";
import { HistoryPage } from "../pages/HistoryPage";
import { LibraryPage } from "../pages/LibraryPage";
import { PracticePage } from "../pages/PracticePage";
import { TrackImportPage } from "../pages/TrackImportPage";

export const router = createBrowserRouter([{
  element: <AppLayout />,
  children: [
    { path: "/", element: <Navigate to="/tracks" replace /> },
    { path: "/tracks", element: <LibraryPage /> },
    { path: "/tracks/new", element: <TrackImportPage /> },
    { path: "/tracks/:id/ear-copy", element: <EarCopyPage /> },
    { path: "/tracks/:id/practice", element: <PracticePage /> },
    { path: "/analysis", element: <AnalysisPage /> },
    { path: "/history", element: <HistoryPage /> },
    { path: "*", element: <Navigate to="/tracks" replace /> },
  ],
}]);