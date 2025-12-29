import React from 'react';
import UpdateForm from '../components/UpdateForm';

// FormPage.jsx
const FormPage = () => {
  const token = new URLSearchParams(window.location.search).get('token');
  return (
    <div className="container">
      <h2>Update Your Details</h2>
      <UpdateForm token={token} />
    </div>
  );
};

export default FormPage;
    