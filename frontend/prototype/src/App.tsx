import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AppShell } from './components/shell/AppShell';
import { AppToaster } from './components/shell/AppToaster';
import { NutritionProvider } from './contexts/NutritionContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { ProgressProvider } from './contexts/ProgressContext';
import { SyncProvider } from './contexts/SyncContext';
import { TrainingProvider } from './contexts/TrainingContext';
import { ExerciseDetail } from './pages/ExerciseDetail';
import { Exercises } from './pages/Exercises';
import { FolderDetail } from './pages/FolderDetail';
import { Folders } from './pages/Folders';
import { History } from './pages/History';
import { More } from './pages/More';
import { Progress } from './pages/Progress';
import { Settings } from './pages/Settings';
import { Today } from './pages/Today';

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <PreferencesProvider>
        <SyncProvider>
          <NutritionProvider>
            <TrainingProvider>
              <ProgressProvider>
                <BrowserRouter>
                  <Routes>
                    <Route element={<AppShell />}>
                      <Route index element={<Today />} />
                      <Route path="history" element={<History />} />
                      <Route path="exercises" element={<Exercises />} />
                      <Route path="exercises/:id" element={<ExerciseDetail />} />
                      <Route path="folders" element={<Folders />} />
                      <Route path="folders/:id" element={<FolderDetail />} />
                      <Route path="progress" element={<Progress />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="more" element={<More />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Routes>
                  <AppToaster />
                </BrowserRouter>
              </ProgressProvider>
            </TrainingProvider>
          </NutritionProvider>
        </SyncProvider>
      </PreferencesProvider>
    </MotionConfig>);

}