import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface Point {
  id: string;
  x: number;
  y: number;
}

export interface Measurements {
  acetabular_angle_left: number;
  acetabular_angle_right: number;
  h_distance_left: number;
  h_distance_right: number;
  d_distance_left: number;
  d_distance_right: number;
}

export interface Diagnosis {
  left: string;
  right: string;
  shenton_left?: string;
  shenton_right?: string;
  calve_left?: string;
  calve_right?: string;
}

interface MedicalState {
  points: Point[];
  points_18: Point[];
  measurements: Measurements | null;
  diagnosis: Diagnosis | null;
  abnormalParameters: string[];
  thresholds: Record<string, number>;
  isEditing: boolean;
  viewMode: 'module1' | 'module2' | 'hidden';
}

const initialState: MedicalState = {
  points: [],
  points_18: [],
  measurements: null,
  diagnosis: null,
  abnormalParameters: [],
  thresholds: {},
  isEditing: false,
  viewMode: 'module1',
};

const medicalSlice = createSlice({
  name: 'medical',
  initialState,
  reducers: {
    setMedicalData: (state, action: PayloadAction<{ 
      points: Point[]; 
      points_18?: Point[];
      measurements: Measurements; 
      diagnosis: Diagnosis; 
      abnormalParameters?: string[];
      thresholds?: Record<string, number>;
    }>) => {
      state.points = action.payload.points;
      state.points_18 = action.payload.points_18 || [];
      state.measurements = action.payload.measurements;
      state.diagnosis = action.payload.diagnosis;
      state.abnormalParameters = action.payload.abnormalParameters || [];
      state.thresholds = action.payload.thresholds || {};
      state.viewMode = 'module1';
    },
    updatePointPosition: (state, action: PayloadAction<{ id: string; x: number; y: number }>) => {
      const point = state.points.find(p => p.id === action.payload.id);
      if (point) {
        point.x = action.payload.x;
        point.y = action.payload.y;
      }
    },
    setEditing: (state, action: PayloadAction<boolean>) => {
      state.isEditing = action.payload;
    },
    updateMeasurements: (state, action: PayloadAction<{ 
      measurements: Measurements; 
      diagnosis: Diagnosis; 
      abnormalParameters?: string[];
      thresholds?: Record<string, number>;
    }>) => {
      state.measurements = action.payload.measurements;
      state.diagnosis = action.payload.diagnosis;
      state.abnormalParameters = action.payload.abnormalParameters || [];
      state.thresholds = action.payload.thresholds || {};
    },
    setViewMode: (state, action: PayloadAction<'module1' | 'module2' | 'hidden'>) => {
      state.viewMode = action.payload;
    },
    resetMedical: () => initialState,
  },
});

export const { setMedicalData, updatePointPosition, setEditing, updateMeasurements, setViewMode, resetMedical } = medicalSlice.actions;
export default medicalSlice.reducer;
