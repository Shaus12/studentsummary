import React, { useState, useEffect } from 'react';

const UsageStatus = () => {
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageStatus();
  }, []);

  const fetchUsageStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/usage-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setUsageData(data);
    } catch (error) {
      console.error('Error fetching usage status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;
  if (!usageData) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-3 mb-4 max-w-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">
          {usageData.membershipType === 'premium' ? '🌟 Premium' : '⭐ Free'}
        </span>
        {usageData.membershipType === 'free' && (
          <span className="text-sm bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
            {usageData.remainingUses}/10 uses left
          </span>
        )}
      </div>
      {usageData.membershipType === 'free' && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full" 
              style={{ width: `${(usageData.usageCount / 10) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsageStatus; 