import { ReportHandler } from 'web-vitals';

/**
 * Reports web vital metrics for performance monitoring
 * 
 * Metrics reported:
 * - CLS (Cumulative Layout Shift): Visual stability
 * - FID (First Input Delay): Interactivity
 * - FCP (First Contentful Paint): Initial render
 * - LCP (Largest Contentful Paint): Loading performance
 * - TTFB (Time to First Byte): Server response time
 *
 * @param onPerfEntry Optional callback function to handle the metrics
 */
const reportWebVitals = async (onPerfEntry?: ReportHandler): Promise<void> => {
  try {
    if (typeof onPerfEntry === 'function') {
      // Dynamic import for better code splitting
      const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');
      
      // Initialize all metrics in parallel for better performance
      Promise.all([
        getCLS(onPerfEntry),
        getFID(onPerfEntry), 
        getFCP(onPerfEntry),
        getLCP(onPerfEntry),
        getTTFB(onPerfEntry)
      ]).catch(error => {
        console.warn('Failed to report web vitals:', error);
      });
    }
  } catch (error) {
    console.warn('Failed to load web-vitals:', error);
  }
};

export default reportWebVitals;
