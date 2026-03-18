import { configureStore } from '@reduxjs/toolkit';
import analysisReducer from './analysisSlice';
import medicalReducer from './medicalSlice';

export const store = configureStore({
  reducer: {
    analysis: analysisReducer,
    medical: medicalReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
