// visitingangelsrjs/src/pages/Scheduler/FindCaregiver/components/hooks/useFetchCaregiverData.js

/**
     * useFetchCaregiverData Hook
     * 
     * A custom React hook to fetch, process, and manage caregiver data and associated schedule dates.
     * Handles API requests, data processing, and state management for caregiver information.
*/

import {useEffect, useState} from 'react';

export default function useFetchCaregiverData() {
  const [caregivers, setCaregivers] = useState([]);
  const [dates, setDates] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const baseUrl = process.env.REACT_APP_BASE_URL;

  useEffect(() => {    
     function to12Hour(time24) {
          const [hStr, m] = time24.split(':');
          let h = parseInt(hStr, 10);
          const suffix = h >= 12 ? 'pm' : 'am';
          h = h % 12 || 12;
          return `${h}:${m}${suffix}`;
      }


    const fetchCaregiverData = async () => {
      try {
		  const csvResponse = await fetch(`${baseUrl}/api/csv-data`);
          let csvData = await csvResponse.json();
          csvData = csvData.data;

          const dbResponse = await fetch(`${baseUrl}/api/db`);
          let dbData = await dbResponse.json();
          dbData = dbData.rows;

          for (let i = 0; i < dbData.length; i++) {
              let rawName = dbData[i].user_id;
              rawName = rawName.split(".");
              let firstName = rawName[0].charAt(0).toUpperCase() + rawName[0].slice(1);
              let lastName = rawName[1].charAt(0).toUpperCase() + rawName[1].slice(1);
			  dbData[i].name = `${lastName}, ${firstName}`;

              let date = dbData[i].available_date;
              date = date.split("T")[0];
              date = date.split("-");
              date = `${date[1]}/${date[2]}/${date[0]}`;
              dbData[i].available_date = date;

              const rawStart = dbData[i].start_time.slice(0, -3);
              const rawEnd = dbData[i].end_time.slice(0, -3);
              const start12 = to12Hour(rawStart);
              const end12 = to12Hour(rawEnd);

              dbData[i].start_time = start12;
              dbData[i].end_time = end12;
              dbData[i].hours = `${start12} to ${end12}`;
          }
          function stripMI(fullName) {
              const parts = fullName.split(' ');
              if (parts.length > 2 && parts[parts.length - 1].length === 1) {
                  return parts.slice(0, -1).join(' ');
              }
              return fullName;
          }

          const headerRow = csvData[0];
          const dateMapping = {};
          
          Object.entries(headerRow).forEach(([key, value]) => {
            if (value && typeof value === 'string' && 
                value.match(/[A-Za-z]{3}\s\d{2}\/\d{2}\/\d{4}/)) {
              const datePart = value.split(' ')[1];
              dateMapping[key] = datePart;
            }
          });
        
          const processedCaregivers = csvData.slice(1).map((details) => {
              const rawName = details['Visits by Caregiver'] || details['Caregiver Name'] || 'Unknown Caregiver';
              const name = rawName.replace(/\s*\[Caregiver\]$/, ''); 
              
              const availability = dbData
                  .filter((entry) => entry.name === stripMI(name))
                  .reduce((acc, entry) => {
                      acc[entry.available_date] = entry.hours;
                      return acc;
                  }, {});
              
              const schedule = {};
              Object.entries(details).forEach(([key, value]) => {
                if (value && value.trim() !== '') {
                  if (dateMapping[key]) {
                    schedule[dateMapping[key]] = value;
                  }
                  else if (key.includes('/')) {
                    schedule[key] = value;
                  }
                }
              });
              
              return { name, schedule, availability };
          });
        setCaregivers(processedCaregivers);

          let allDates = [];
          
          if (Object.keys(dateMapping).length > 0) {
            allDates = Object.values(dateMapping);
          } else {
            allDates = Array.from(
              new Set(
                csvData.flatMap((caregiver) =>
                  Object.keys(caregiver).filter((key) => key.includes('/'))
                )
              )
            );
          }
          
          allDates.sort((a, b) => new Date(a) - new Date(b));

          const formattedDates = allDates.map((dateStr) => {
            const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
            return {
              day: dayName,
              date: dateStr,
              fullDate: dateStr,
            };
          });

        setDates(formattedDates);
        setError('');
      } catch (err) {
        console.error('Error fetching caregiver data:', err);
        setError(err.response?.csvData?.error || 'Failed to fetch csv data');
      } finally {
        setLoading(false);
      }
    };

    fetchCaregiverData();
  }, [baseUrl]);

  return { caregivers, dates, loading, error };
}
