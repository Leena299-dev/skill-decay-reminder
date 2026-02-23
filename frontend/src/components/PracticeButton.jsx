import React from 'react';
import './PracticeButton.css';

const PracticeButton = ({ skillName, onClick }) => {
  return (
    <button className="practice-button" onClick={onClick}>
      Practice {skillName}
    </button>
  );
};

export default PracticeButton;
