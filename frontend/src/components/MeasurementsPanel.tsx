import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import clsx from 'clsx';

const MeasurementsPanel: React.FC = () => {
  const { measurements, diagnosis, abnormalParameters, thresholds } = useSelector((state: RootState) => state.medical);
  const { mode, ageMonths, gender } = useSelector((state: RootState) => state.analysis);

  if (!measurements || !diagnosis) return null;

  const getDiagnosisColor = (diag: string) => {
    switch(diag) {
      case 'normal': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'pre_subluxation': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'subluxation': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'dislocation': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatDiag = (diag: string) => {
    switch(diag) {
      case 'normal': return 'Норма';
      case 'pre_subluxation': return 'I ст. предвывих';
      case 'subluxation': return 'II ст. подвывих';
      case 'dislocation': return 'III ст. вывих';
      case 'broken': return 'Прервана';
      default: return diag;
    }
  };

  const isAbnormal = (param: string) => abnormalParameters.includes(param);

  return (
    <div className="flex flex-col gap-6">
      
      {/* Patient Info Header */}
      <div className="flex justify-between items-center px-1">
        <h2 className="font-bold text-lg text-foreground/90">Результаты анализа</h2>
        <div className="text-xs glass px-3 py-1 rounded-full opacity-70 bg-primary/5 text-primary border border-primary/20">
          {gender === 'boy' ? 'Мальчик' : 'Девочка'}, {Math.floor((ageMonths || 0) / 12)}г {(ageMonths || 0) % 12}мес
        </div>
      </div>

      {/* Diagnosis Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className={clsx("p-4 rounded-xl border transition-colors", getDiagnosisColor(diagnosis.left))}>
          <div className="text-sm font-semibold opacity-80 mb-1">Левый сустав</div>
          <div className="text-xl font-bold">{formatDiag(diagnosis.left)}</div>
        </div>
        <div className={clsx("p-4 rounded-xl border transition-colors", getDiagnosisColor(diagnosis.right))}>
          <div className="text-sm font-semibold opacity-80 mb-1">Правый сустав</div>
          <div className="text-xl font-bold">{formatDiag(diagnosis.right)}</div>
        </div>
      </div>

      {/* Measurements Table */}
      <div className="glass rounded-xl overflow-hidden shadow-sm border border-foreground/5">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-foreground/5 text-sm uppercase tracking-wider text-foreground/70">
              <th className="p-4 font-medium">Параметр</th>
              <th className="p-4 font-medium">Левый</th>
              <th className="p-4 font-medium">Правый</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/5 font-medium">
            <tr>
              <td className="p-4 text-foreground/80">Ацетабулярный угол (α)</td>
              <td className={clsx("p-4 transition-colors", isAbnormal("acetabular_angle_left") ? "text-red-500 font-bold" : "text-foreground")}>
                {measurements.acetabular_angle_left}°
              </td>
              <td className={clsx("p-4 transition-colors", isAbnormal("acetabular_angle_right") ? "text-red-500 font-bold" : "text-foreground")}>
                {measurements.acetabular_angle_right}°
              </td>
            </tr>
            <tr>
              <td className="p-4 text-foreground/80">Дистанция d</td>
              <td className={clsx("p-4 transition-colors", isAbnormal("d_distance_left") ? "text-red-500 font-bold" : "text-foreground")}>
                {measurements.d_distance_left} мм
              </td>
              <td className={clsx("p-4 transition-colors", isAbnormal("d_distance_right") ? "text-red-500 font-bold" : "text-foreground")}>
                {measurements.d_distance_right} мм
              </td>
            </tr>
            <tr>
              <td className="p-4 text-foreground/80">Высота h</td>
              <td className={clsx("p-4 transition-colors", isAbnormal("h_distance_left") ? "text-red-500 font-bold" : "text-foreground")}>
                {measurements.h_distance_left} мм
              </td>
              <td className={clsx("p-4 transition-colors", isAbnormal("h_distance_right") ? "text-red-500 font-bold" : "text-foreground")}>
                {measurements.h_distance_right} мм
              </td>
            </tr>
            {diagnosis.shenton_left && (
              <tr>
                <td className="p-4 text-foreground/80">Линия Шентона</td>
                <td className={clsx("p-4 transition-colors", diagnosis.shenton_left !== 'normal' ? "text-red-500 font-bold" : "text-green-500")}>
                  {formatDiag(diagnosis.shenton_left)}
                </td>
                <td className={clsx("p-4 transition-colors", diagnosis.shenton_right !== 'normal' ? "text-red-500 font-bold" : "text-green-500")}>
                  {formatDiag(diagnosis.shenton_right || 'normal')}
                </td>
              </tr>
            )}
            {diagnosis.calve_left && (
              <tr>
                <td className="p-4 text-foreground/80">Линия Кальве</td>
                <td className={clsx("p-4 transition-colors", diagnosis.calve_left !== 'normal' ? "text-red-500 font-bold" : "text-green-500")}>
                  {formatDiag(diagnosis.calve_left)}
                </td>
                <td className={clsx("p-4 transition-colors", diagnosis.calve_right !== 'normal' ? "text-red-500 font-bold" : "text-green-500")}>
                  {formatDiag(diagnosis.calve_right || 'normal')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reference Norms for specific patient */}
      {thresholds && Object.keys(thresholds).length > 0 && (
        <div className="glass rounded-xl p-5 border border-primary/10 bg-primary/5">
          <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-primary flex items-center gap-2">
             Нормы для данного пациента
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="flex flex-col">
              <span className="text-xs opacity-60">Угол (α) макс</span>
              <span className="font-bold text-lg">{thresholds.max_alpha}°</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs opacity-60">h (мин)</span>
              <span className="font-bold text-lg">{thresholds.min_h} мм</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs opacity-60">d (макс)</span>
              <span className="font-bold text-lg">{thresholds.max_d} мм</span>
            </div>
          </div>
          <p className="mt-3 text-[10px] opacity-50 italic">
            *Нормы определены на основе стола возрастных порогов и пола ребенка.
          </p>
        </div>
      )}

      {/* Generic Norms table (student mode only) */}
      {mode === 'student' && (!thresholds || Object.keys(thresholds).length === 0) && (
        <div className="glass rounded-xl p-5 mt-4 border border-foreground/5">
          <h3 className="font-bold mb-3 text-lg flex items-center gap-2 text-foreground/90">
             Таблица норм (возрастная)
          </h3>
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-foreground/5 border-b border-foreground/10 text-foreground/70">
                  <th className="p-2 font-medium">Возраст</th>
                  <th className="p-2 font-medium">Угол (α)</th>
                  <th className="p-2 font-medium">h (мин)</th>
                  <th className="p-2 font-medium">d (макс)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10 text-foreground/70">
                <tr>
                  <td className="p-2">0-3 мес</td>
                  <td className="p-2">30-34°</td>
                  <td className="p-2">&gt;9 мм</td>
                  <td className="p-2">15 мм</td>
                </tr>
                <tr>
                  <td className="p-2">1 год</td>
                  <td className="p-2">20-24°</td>
                  <td className="p-2">&gt;10 мм</td>
                  <td className="p-2">14 мм</td>
                </tr>
                <tr>
                  <td className="p-2">5 лет</td>
                  <td className="p-2">15-18°</td>
                  <td className="p-2">&gt;13 мм</td>
                  <td className="p-2">11 мм</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default MeasurementsPanel;
